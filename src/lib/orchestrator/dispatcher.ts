// dispatcher.ts — the single orchestrator entry point (SPEC v5 §9.2). One user goal in →
// scaffold → tier-cap gate → durable run → fired at the Modal runtime. Every branch returns a
// typed DispatchOutcome the chat surface renders (simple / dispatched / capped / disabled).
//
// All external effects (tier read, scaffold LLM, usage reservation, run persistence, runtime
// dispatch, brain/context load) are injected via `deps` so the routing + cap + plan-then-fire
// logic is unit-tested with mocks (no DB, no network, no LLM). Production wiring is in
// defaultDeps below.

import {
  orchestratorEnabled,
  defaultTimeBudgetSeconds,
  maxConcurrentRunsPerUser,
} from "./feature-flag";
import {
  buildScaffold,
  isSimpleGoal,
  type PlannerContext,
  type PlannerLlm,
} from "./planner";
import {
  estimateAgentMinutes,
  type DispatchOutcome,
  type Scaffold,
  type SubAgentSpec,
} from "./types";
import {
  canDispatchRun,
  evaluateSubAgentFanout,
  getCurrentTier,
  reserveRun,
  type Tier,
} from "./tier-caps";
import {
  countActiveRuns,
  insertRun,
  logPhaseEnter,
  reconcileAgentMinutes,
  updateRun,
} from "./db";
import { monthKey } from "./tier-caps";
import { dispatch as runtimeDispatch, type DispatchJob, type DispatchResult } from "./runtime-client";
import { completeLlm } from "@/lib/llm/dispatch";
import { fetchPaUser } from "@/lib/pa-supabase";
import { checkBudgetGate, type BudgetGate } from "@/lib/cost/budget";
import { stageCostBudgetGateCard } from "@/lib/cost/gate-card";

// ── Dependency surface (mocked in tests) ──────────────────────────────────────────────────

export type DispatcherDeps = {
  getTier: (businessId: string) => Promise<Tier>;
  countActiveRuns: (businessId: string) => Promise<number>;
  loadContext: (businessId: string) => Promise<{ ctx: PlannerContext; brainRepo: string | null }>;
  llm: (businessId: string) => PlannerLlm;
  reserveRun: (businessId: string, minutes: number) => ReturnType<typeof reserveRun>;
  releaseReservation: (businessId: string, minutes: number) => Promise<void>;
  insertRun: typeof insertRun;
  updateRun: typeof updateRun;
  logPhaseEnter: typeof logPhaseEnter;
  dispatchRuntime: (job: DispatchJob) => Promise<DispatchResult>;
  maxConcurrent: () => number;
  timeBudgetSeconds: () => number;
  // Cost soft-pause gate (Cost Observability SPEC §5.4, PA-COST-14). Runs BEFORE a sub-agent fires;
  // chat is exempt (PA-COST-7) so it's only wired here, not in the chat loop. Injected for tests.
  checkBudget: (ownerId: string) => Promise<BudgetGate>;
  stageBudgetGateCard: (
    ownerId: string,
    gate: Extract<BudgetGate, { status: "block_100" }>,
  ) => Promise<string | null>;
};

// Default planner LLM: PA-managed Claude via the BYO dispatcher, keyed by the owner's stored
// Anthropic key. On any failure the planner falls back to a deterministic scaffold, so a
// missing key never blocks dispatch.
function defaultLlm(businessId: string): PlannerLlm {
  return async ({ system, user }) => {
    const paRes = await fetchPaUser(businessId);
    const key = paRes.ok && paRes.data ? paRes.data.anthropic_api_key ?? "" : "";
    const res = await completeLlm({
      userId: businessId,
      paManagedKey: key,
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 1500,
    });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, text: res.text };
  };
}

async function defaultLoadContext(
  businessId: string,
): Promise<{ ctx: PlannerContext; brainRepo: string | null }> {
  const paRes = await fetchPaUser(businessId);
  const brainRepo = paRes.ok && paRes.data ? paRes.data.brain_repo : null;
  // Connector + persona discovery is best-effort; the planner degrades to read-only / pocket-
  // agent tasks when nothing is available. (Wired thin here; Wave C grows the connector list.)
  return { ctx: { availableConnectors: [], availablePersonas: [] }, brainRepo };
}

export const defaultDeps: DispatcherDeps = {
  getTier: getCurrentTier,
  countActiveRuns,
  loadContext: defaultLoadContext,
  llm: defaultLlm,
  reserveRun,
  releaseReservation: async (businessId, minutes) => {
    // Release a reservation we couldn't actually dispatch: reconcile reserved→0 actual.
    await reconcileAgentMinutes({
      businessId,
      month: monthKey(),
      reserved: minutes,
      actual: 0,
      cost: 0,
    });
  },
  insertRun,
  updateRun,
  logPhaseEnter,
  dispatchRuntime: runtimeDispatch,
  maxConcurrent: maxConcurrentRunsPerUser,
  timeBudgetSeconds: defaultTimeBudgetSeconds,
  checkBudget: checkBudgetGate,
  stageBudgetGateCard: stageCostBudgetGateCard,
};

// Human-readable dollar amounts for the budget-gate copy. Budget is whole-dollar cents; spend is
// micro-cents (PA-COST-9). Kept here (not in the lib) because it's surface copy, not budget logic.
function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────────────────

function leafCount(scaffold: Scaffold): number {
  return scaffold.milestones.reduce((n, m) => n + m.tasks.length, 0);
}

/** Best-effort connector scopes for a scaffold: distinct task executors that look like a
 *  connector (not 'pocket-agent' / a persona). Declared as bare connector names → the action
 *  guard grants every action on each. ContainmentGuard blocks anything not listed. */
export function deriveToolScopes(scaffold: Scaffold): string[] {
  const scopes = new Set<string>();
  for (const m of scaffold.milestones) {
    for (const t of m.tasks) {
      const ex = t.executor.trim().toLowerCase();
      if (!ex || ex === "pocket-agent" || ex === "pocket agent") continue;
      scopes.add(ex);
    }
  }
  return [...scopes];
}

/** The run-level ISA the Modal runtime executes (it fans out to leaves internally). */
export function buildRunSpec(
  goal: string,
  scaffold: Scaffold,
  toolScopes: string[],
): SubAgentSpec {
  return {
    objective: goal.slice(0, 2_000),
    toolScopes,
    readZones: [],
    definitionOfDone: scaffold.definitionOfDone,
    context: { scaffold },
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────────────────

export type DispatchUserGoalInput = {
  businessId: string;
  goal: string;
  originatingMessageId?: string | null;
};

/**
 * Plan + (maybe) dispatch a sub-agent run for a user goal. Order of gates:
 *   1. master flag off                → disabled
 *   2. simple read-only goal          → simple   (caller answers inline via Wave A)
 *   3. too many runs already in flight → capped
 *   4. scaffold the goal (LLM, falls back deterministically)
 *   5. sub-agent fan-out exceeds tier  → capped
 *   6. atomic agent-minute reservation → capped on refusal
 *   7. persist the run, fire at the runtime (or leave plan-only when runtime unconfigured)
 */
export async function dispatchUserGoal(
  input: DispatchUserGoalInput,
  deps: DispatcherDeps = defaultDeps,
): Promise<DispatchOutcome> {
  const { businessId, goal } = input;

  if (!orchestratorEnabled()) {
    return { kind: "disabled", reason: "The orchestrator isn't enabled yet." };
  }
  if (isSimpleGoal(goal)) {
    return {
      kind: "simple",
      reason: "This looks like a quick lookup — answering directly without spawning a run.",
    };
  }

  const active = await deps.countActiveRuns(businessId);
  if (active >= deps.maxConcurrent()) {
    return {
      kind: "capped",
      reason:
        `You already have ${active} task${active === 1 ? "" : "s"} running. ` +
        "Wait for one to finish (or cancel it) before starting another.",
    };
  }

  // Cost soft-pause gate (PA-COST-14). Runs BEFORE scaffolding so a gated owner never pays the planner
  // cost either. Chat is exempt (PA-COST-7) — only this sub-agent-dispatch path gates.
  const gate = await deps.checkBudget(businessId);
  if (gate.status === "warn_80") {
    const pctText = Math.round(gate.pct);
    return {
      kind: "budget_warn",
      spentMicroCents: gate.spentMicroCents,
      budgetCents: gate.budgetCents,
      pct: gate.pct,
      reason:
        `You're at ${pctText}% of your ${dollars(gate.budgetCents)} monthly cost budget — ` +
        "keep going, pause new agent runs for the month, or raise the cap?",
    };
  }
  if (gate.status === "block_100") {
    const inboxItemId = await deps.stageBudgetGateCard(businessId, gate);
    return {
      kind: "budget_gated",
      inboxItemId,
      spentMicroCents: gate.spentMicroCents,
      budgetCents: gate.budgetCents,
      pct: gate.pct,
      reason:
        `You've hit your ${dollars(gate.budgetCents)} monthly cost budget, so I've paused new ` +
        "background agent runs and parked this one in Mission Control. Raise the cap in Settings → " +
        "Budget to let it run, or it'll resume when your budget resets next month. (Your chat keeps working.)",
    };
  }

  const tier = await deps.getTier(businessId);
  const { ctx, brainRepo } = await deps.loadContext(businessId);

  // 4. Scaffold (Project → Milestones → Tasks). Never throws — deterministic fallback.
  const { scaffold } = await buildScaffold(goal, ctx, deps.llm(businessId));

  // 5. Sub-agent fan-out cap.
  const fanout = evaluateSubAgentFanout(tier, leafCount(scaffold));
  if (!fanout.ok) return { kind: "capped", reason: fanout.reason };

  // 6. Atomic agent-minute reservation (race-free; the real gate).
  const budgetSeconds = deps.timeBudgetSeconds();
  const minutes = estimateAgentMinutes(scaffold, budgetSeconds);
  const reservation = await deps.reserveRun(businessId, minutes);
  if (!reservation.ok) return { kind: "capped", reason: reservation.reason };

  // 7. Persist the run + fire it.
  const toolScopes = deriveToolScopes(scaffold);
  const run = await deps.insertRun({
    businessId,
    originatingMessageId: input.originatingMessageId ?? null,
    status: "planning",
    specJson: { goal, scaffold },
    toolScopes,
    timeBudgetSeconds: budgetSeconds,
    agentMinutes: minutes,
  });

  const job: DispatchJob = {
    runId: run.id,
    businessId,
    spec: buildRunSpec(goal, scaffold, toolScopes),
    timeBudgetSeconds: budgetSeconds,
    brainRepo,
  };
  const fired = await deps.dispatchRuntime(job);

  if (fired.ok) {
    await deps.updateRun(run.id, { status: "running", startedAt: new Date().toISOString() });
    await deps.logPhaseEnter(run.id, "observe", "Run dispatched to the runtime.");
    return {
      kind: "dispatched",
      runId: run.id,
      scaffold,
      dispatched: true,
      reason: "On it — spawning a sub-agent to do the work. I'll stage anything external for your approval.",
    };
  }

  // Runtime not configured → keep the plan; nothing fired (still demoable).
  if (fired.degraded === "not_configured") {
    return {
      kind: "dispatched",
      runId: run.id,
      scaffold,
      dispatched: false,
      reason:
        "Here's the plan. The execution runtime isn't switched on yet, so I've saved the plan " +
        "without running it.",
    };
  }

  // Runtime errored → release the reservation + mark the run failed.
  await deps.releaseReservation(businessId, minutes);
  await deps.updateRun(run.id, {
    status: "failed",
    resultSummary: `Could not reach the runtime: ${fired.error}`,
  });
  return {
    kind: "dispatched",
    runId: run.id,
    scaffold,
    dispatched: false,
    reason: "I planned the task but couldn't reach the execution runtime. Try again shortly.",
  };
}

// Re-exported for the soft pre-check the chat surface can call before committing.
export { canDispatchRun };
