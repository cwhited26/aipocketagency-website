// runner.ts — the Gate Phase fan-out + aggregation (SPEC §7). Sits between the dispatcher's
// "plan approved" point and its "fire leaf tasks" call. Runs every enabled, applicable gate in
// parallel against the SAME (plan + the slice of brain rule-files each gate declared), bounds each
// by the 60s budget (PA-GATE-8), folds the findings into one verdict (clean / flagged / blocked),
// persists the findings, advances each gate's trust window, and returns the verdict the dispatcher acts on.
//
// Fail closed everywhere (PA-GATE-4): a gate that times out, throws, returns malformed output, or
// whose required rule-file can't be read becomes an 'error' result — which aggregates to 'blocked',
// never an auto-pass. All effects are injected so the fan-out + aggregation are unit-tested with no
// network, no LLM, no DB.

import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent } from "@/lib/pa-brain";
import { completeLlm } from "@/lib/llm/dispatch";
import {
  aggregateVerdict,
  GateVerdictSchema,
  type GateFinding,
  type GateName,
  type GatePhaseResult,
  type GateResult,
} from "./schema";
import type { GateDefinition, GateLlm, RuleFileSpec } from "./types";
import { ALL_GATES } from "./registry";
import { planInvolvesCode } from "./plan-render";
import { gateConnectorBudgetUsd, gateTimeBudgetMs } from "./config";
import { gateTrustWindow, isFindingOverridable } from "./trust";
import { GateAuditError } from "./llm-audit";
import { insertGateFindings, listGateOverrides, recordGateResult } from "./db";
import type { Scaffold } from "../types";

// The owner's per-gate trust state as it stood BEFORE this run — drives both which gates are
// skipped (enabled=false) and whether each gate's flag is Approve-anyway-able on the card.
export type GateOverrideSnapshot = {
  enabled: boolean;
  cleanPassCount: number;
  autoDismissEnabled: boolean;
};
export type OverrideMap = ReadonlyMap<GateName, GateOverrideSnapshot>;

export type GatePhaseInput = {
  businessId: string;
  projectId: string;
  goal: string;
  scaffold: Scaffold;
  planVersion: number;
};

export type GatePhaseDeps = {
  // Reads one brain rule-file → its text, or null when missing/unreadable.
  readRuleFile: (path: string) => Promise<string | null>;
  llm: GateLlm;
  // The owner's per-gate trust state BEFORE this run (skip toggles + Approve-anyway eligibility).
  overrides: OverrideMap;
  timeBudgetMs: number;
  connectorBudgetUsd: number;
  now: () => number;
  persistFindings: (rows: Parameters<typeof insertGateFindings>[0]) => Promise<void>;
  recordResult: (input: {
    userId: string;
    gateName: GateName;
    clean: boolean;
    threshold: number;
  }) => Promise<number>;
};

class GateTimeoutError extends Error {
  constructor(ms: number) {
    super(`gate exceeded its ${ms}ms budget`);
    this.name = "GateTimeoutError";
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new GateTimeoutError(ms)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/** Builds a full, schema-valid finding for a fail-closed 'error' result. */
function errorFinding(gate: GateName, reason: string): GateFinding {
  return {
    rule_violated: "Gate could not complete — failing closed (a broken safety check is a failed check).",
    rule_source: `Gate runner (${gate})`,
    plan_task_violating: "Whole plan",
    severity: "high",
    suggested_fix: "Revise the plan or try again; the gate must produce a clean verdict before this fires.",
    evidence: reason,
  };
}

/** Which gates run for this plan: enabled by default, not owner-disabled, and applicable. */
export function selectGates(scaffold: Scaffold, overrides: OverrideMap): GateDefinition[] {
  const involvesCode = planInvolvesCode(scaffold);
  return ALL_GATES.filter((g) => {
    if (!g.enabledByDefault) return false;
    if (overrides.get(g.name)?.enabled === false) return false;
    if (g.appliesTo === "code" && !involvesCode) return false;
    return true;
  });
}

function readableRequired(specs: RuleFileSpec[], cache: ReadonlyMap<string, string | null>): boolean {
  const required = specs.filter((s) => s.required);
  if (required.length === 0) return true;
  // At least one required file must be readable (non-empty). Fail closed otherwise.
  return required.some((s) => {
    const c = cache.get(s.path);
    return typeof c === "string" && c.trim().length > 0;
  });
}

/** Runs one gate to a GateResult, converting every failure mode into a fail-closed 'error'. */
async function runOneGate(
  def: GateDefinition,
  scaffold: Scaffold,
  goal: string,
  businessId: string,
  cache: ReadonlyMap<string, string | null>,
  snapshot: GateOverrideSnapshot | undefined,
  deps: GatePhaseDeps,
): Promise<GateResult> {
  const start = deps.now();
  const budget = deps.timeBudgetMs;
  const stamp = (status: GateResult["status"], finding: GateFinding | null): GateResult => ({
    gateName: def.name,
    status,
    finding,
    actualMs: Math.max(0, deps.now() - start),
    timeBudgetMs: budget,
    // Whether the owner may "Approve anyway" THIS finding — evaluated against the PRE-run streak.
    overridable: isFindingOverridable({
      gate: def.name,
      status,
      cleanPassCount: snapshot?.cleanPassCount ?? 0,
      autoDismissEnabled: snapshot?.autoDismissEnabled ?? false,
    }),
  });

  if (!readableRequired(def.ruleFiles, cache)) {
    const missing = def.ruleFiles.filter((s) => s.required).map((s) => s.path).join(", ");
    return stamp("error", errorFinding(def.name, `required rule-file unreadable: ${missing}`));
  }

  const ruleFiles = new Map<string, string | null>();
  for (const spec of def.ruleFiles) ruleFiles.set(spec.path, cache.get(spec.path) ?? null);

  try {
    const verdict = await withTimeout(
      def.run({ businessId, goal, scaffold, ruleFiles, involvesCode: planInvolvesCode(scaffold), connectorBudgetUsd: deps.connectorBudgetUsd }, deps.llm),
      budget,
    );
    // Re-validate the shape even for deterministic gates — the contract is the runner's, not the gate's.
    const parsed = GateVerdictSchema.safeParse(verdict);
    if (!parsed.success) {
      return stamp("error", errorFinding(def.name, `malformed verdict: ${parsed.error.issues[0]?.message ?? "shape mismatch"}`));
    }
    return stamp(parsed.data.status, parsed.data.finding ?? null);
  } catch (e) {
    if (e instanceof GateTimeoutError) return stamp("error", errorFinding(def.name, e.message));
    if (e instanceof GateAuditError) return stamp("error", errorFinding(def.name, e.message));
    return stamp("error", errorFinding(def.name, e instanceof Error ? e.message : "unknown gate error"));
  }
}

/**
 * The pure, deps-injected Gate Phase. Reads each selected gate's rule-files (deduped across gates —
 * CLAUDE.md is read once), fans them out in parallel under the time budget, aggregates, persists,
 * and advances per-gate trust windows. Returns the aggregate verdict + every gate result.
 */
export async function executeGatePhase(
  input: GatePhaseInput,
  deps: GatePhaseDeps,
): Promise<GatePhaseResult> {
  const gates = selectGates(input.scaffold, deps.overrides);

  // Pre-read the union of declared rule-files once (CLAUDE.md shared by 3 gates → one fetch).
  const paths = new Set<string>();
  for (const g of gates) for (const rf of g.ruleFiles) paths.add(rf.path);
  const cache = new Map<string, string | null>();
  await Promise.all(
    [...paths].map(async (p) => {
      cache.set(p, await deps.readRuleFile(p).catch(() => null));
    }),
  );

  const results = await Promise.all(
    gates.map((g) =>
      runOneGate(g, input.scaffold, input.goal, input.businessId, cache, deps.overrides.get(g.name), deps),
    ),
  );

  // Persist all findings for this (project, plan_version).
  await deps.persistFindings(
    results.map((r) => ({
      businessId: input.businessId,
      projectId: input.projectId,
      planVersion: input.planVersion,
      gateName: r.gateName,
      status: r.status,
      finding: r.finding,
      timeBudgetMs: r.timeBudgetMs,
      actualMs: r.actualMs,
    })),
  );

  // Advance each gate's trust window: a 'pass' is a clean pass of THIS gate; anything else resets it.
  await Promise.all(
    results.map((r) =>
      deps
        .recordResult({
          userId: input.businessId,
          gateName: r.gateName,
          clean: r.status === "pass",
          threshold: gateTrustWindow(r.gateName),
        })
        .catch(() => 0),
    ),
  );

  return { verdict: aggregateVerdict(results), planVersion: input.planVersion, results };
}

// ── Production wiring ──────────────────────────────────────────────────────────────────

/**
 * The dispatcher-facing entry point: wires the real brain reader (owner's repo + token), the
 * PA-managed LLM, the owner's disabled-gate set, and the DB writers, then runs the phase.
 */
export async function runGatePhase(input: GatePhaseInput): Promise<GatePhaseResult> {
  const paRes = await fetchPaUser(input.businessId);
  const repo = paRes.ok && paRes.data ? paRes.data.brain_repo : null;
  const token = paRes.ok && paRes.data ? paRes.data.github_token : null;
  const anthropicKey = paRes.ok && paRes.data ? paRes.data.anthropic_api_key ?? "" : "";

  // Load the owner's per-gate trust state (skip toggles + Approve-anyway eligibility), snapshotting
  // it BEFORE this run advances the streaks.
  const overrideRows = await listGateOverrides(input.businessId).catch(() => []);
  const overrides: Map<GateName, GateOverrideSnapshot> = new Map(
    overrideRows.map((o) => [
      o.gate_name,
      {
        enabled: o.enabled,
        cleanPassCount: o.clean_pass_count,
        autoDismissEnabled: o.auto_dismiss_enabled,
      },
    ]),
  );

  const llm: GateLlm = async ({ system, user }) => {
    const res = await completeLlm({
      userId: input.businessId,
      paManagedKey: anthropicKey,
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 1_200,
    });
    return res.ok ? { ok: true, text: res.text } : { ok: false, error: res.error };
  };

  return executeGatePhase(input, {
    readRuleFile: (path) => (repo ? fetchFileContent(repo, path, token) : Promise.resolve(null)),
    llm,
    overrides,
    timeBudgetMs: gateTimeBudgetMs(),
    connectorBudgetUsd: gateConnectorBudgetUsd(),
    now: () => Date.now(),
    persistFindings: insertGateFindings,
    recordResult: recordGateResult,
  });
}
