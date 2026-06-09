// types.ts — the shared vocabulary of the orchestrator (PA v5 Wave B).
//
// Every value that crosses an API boundary (the Modal webhook, the dispatch entry point,
// the cancel route) or lands in a pa_sub_agent_* / pa_action_approvals row is validated by a
// Zod schema declared here, so a malformed plan, spec, or webhook payload fails loudly at
// the edge instead of corrupting a run. Types are derived from the schemas (z.infer) — one
// source of truth, zero `any`.

import { z } from "zod";

// ── Run status ────────────────────────────────────────────────────────────────────────
// 'verifying' (Mission Control) = a completed run undergoing the second-opinion gate.
// 'zombie' = the Watchdog reclaimed it after the heartbeat went stale (>60s). Both are
// deliberately NON-terminal: a late run_complete can still revive a zombie and reconcile it.
export const RUN_STATUSES = [
  "planning",
  "running",
  "paused",
  "verifying",
  "zombie",
  "done",
  "failed",
  "canceled",
] as const;
export const RunStatusSchema = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatusSchema>;

/** Statuses a run can still leave (not yet terminal). zombie stays non-terminal on purpose. */
export const TERMINAL_STATUSES: readonly RunStatus[] = ["done", "failed", "canceled"];
export function isTerminalStatus(s: RunStatus): boolean {
  return TERMINAL_STATUSES.includes(s);
}

// ── Verification verdict (advisory second-opinion gate, PA-MC-7) ────────────────────────
// Mirrors the pa_verification_log + pa_sub_agent_runs.verification_verdict CHECK.
export const VERIFICATION_VERDICTS = ["pass", "fail", "abstain"] as const;
export const VerificationVerdictSchema = z.enum(VERIFICATION_VERDICTS);
export type VerificationVerdict = z.infer<typeof VerificationVerdictSchema>;

// ── 7-phase Algorithm (PAI / PA-ORCH-8) ─────────────────────────────────────────────────
export const PHASES = [
  "observe",
  "think",
  "plan",
  "build",
  "execute",
  "verify",
  "learn",
] as const;
export const PhaseSchema = z.enum(PHASES);
export type Phase = z.infer<typeof PhaseSchema>;

// ── Connector-action approval status (mirrors the DB CHECK on pa_connector_action_log) ──
export const ACTION_STATUSES = [
  "staged",
  "approved",
  "rejected",
  "executed",
  "failed",
] as const;
export const ActionStatusSchema = z.enum(ACTION_STATUSES);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

// ── Sub-agent spec (the auto-generated ISA the runtime executes) ─────────────────────────
// A compact ISA: what the sub-agent is for, what it may touch, and how it knows it's done.
export const SubAgentSpecSchema = z.object({
  // One-line statement of what this sub-agent accomplishes.
  objective: z.string().min(1).max(2_000),
  // The connectors/tools the sub-agent is permitted to call. Enforced by ContainmentGuard
  // on the action path — anything not declared here is blocked before the LLM can suggest it.
  toolScopes: z.array(z.string().min(1).max(120)).max(50).default([]),
  // Brain zones the sub-agent may read (zone keys, not paths).
  readZones: z.array(z.string().min(1).max(120)).max(50).default([]),
  // The definition-of-done the VERIFY phase checks against.
  definitionOfDone: z.string().max(2_000).default(""),
  // Free-form context handed to the runtime (e.g. the milestone/task this leaf belongs to).
  context: z.record(z.string(), z.unknown()).default({}),
});
export type SubAgentSpec = z.infer<typeof SubAgentSpecSchema>;

// ── Project Scaffolding (Jeff Hunter pattern, PA-ORCH-13) ───────────────────────────────
export const TASK_STATUSES = [
  "planned",
  "in_progress",
  "blocked",
  "done",
  "canceled",
] as const;
export const TaskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const ScaffoldTaskSchema = z.object({
  title: z.string().min(1).max(300),
  // What the task needs to start.
  inputs: z.string().max(1_000).default(""),
  // What the task produces.
  expectedOutput: z.string().max(1_000).default(""),
  // Which connector or persona executes this leaf (free text in the plan; resolved at dispatch).
  executor: z.string().max(200).default(""),
  status: TaskStatusSchema.default("planned"),
});
export type ScaffoldTask = z.infer<typeof ScaffoldTaskSchema>;

export const ScaffoldMilestoneSchema = z.object({
  title: z.string().min(1).max(300),
  definitionOfDone: z.string().max(1_000).default(""),
  tasks: z.array(ScaffoldTaskSchema).min(1).max(12),
  status: TaskStatusSchema.default("planned"),
});
export type ScaffoldMilestone = z.infer<typeof ScaffoldMilestoneSchema>;

export const ScaffoldSchema = z.object({
  // One-line goal restated.
  project: z.string().min(1).max(500),
  definitionOfDone: z.string().max(2_000).default(""),
  successCriteria: z.array(z.string().min(1).max(500)).max(12).default([]),
  milestones: z.array(ScaffoldMilestoneSchema).min(1).max(8),
});
export type Scaffold = z.infer<typeof ScaffoldSchema>;

// ── pa_sub_agent_runs row (as PostgREST returns it) ─────────────────────────────────────
// The Mission Control telemetry columns (migration 038) are `.optional()` so a row read from a
// project that hasn't applied 038 yet still parses — PostgREST omits unknown columns and the
// projection treats them as null/0. Never widen this to `any`; add a typed field instead.
export const SubAgentRunRowSchema = z.object({
  id: z.string(),
  business_id: z.string(),
  originating_message_id: z.string().nullable(),
  status: RunStatusSchema,
  spec_json: z.unknown(),
  tool_scopes: z.array(z.string()),
  time_budget_seconds: z.number().int(),
  started_at: z.string().nullable(),
  phase_progress: z.unknown(),
  result_summary: z.string().nullable(),
  token_cost: z.number().int(),
  agent_minutes: z.coerce.number(),
  created_at: z.string(),
  updated_at: z.string(),
  // Mission Control telemetry (migration 038).
  last_heartbeat_at: z.string().nullable().optional(),
  retries_used: z.number().int().nullable().optional(),
  retry_budget: z.number().int().nullable().optional(),
  verification_verdict: VerificationVerdictSchema.nullable().optional(),
  needs_human: z.boolean().optional(),
  // Skills poisoning defense (migration 059, PA-SKILL-7): a run born from untrusted inbound
  // content (email / SMS / public persona) may LOAD Skills in its zone but never PROPOSE one in
  // the LEARN phase. Optional so a row from a project that hasn't applied 059 still parses.
  untrusted_origin: z.boolean().optional(),
});
export type SubAgentRunRow = z.infer<typeof SubAgentRunRowSchema>;

// ── Webhook payload (Modal runtime → PA) ────────────────────────────────────────────────
// The runtime calls POST /api/orchestrator/webhook with run-status updates. A shared secret
// (PA_ORCHESTRATOR_RUNTIME_TOKEN) authenticates the call; this schema validates the body.
export const WebhookEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("phase_enter"),
    runId: z.string().min(1),
    phase: PhaseSchema,
    note: z.string().max(2_000).optional(),
  }),
  z.object({
    type: z.literal("phase_complete"),
    runId: z.string().min(1),
    phase: PhaseSchema,
    durationMs: z.number().int().nonnegative().max(86_400_000),
    note: z.string().max(2_000).optional(),
  }),
  z.object({
    type: z.literal("action_staged"),
    runId: z.string().min(1),
    connector: z.string().min(1).max(120),
    action: z.string().min(1).max(120),
    payload: z.record(z.string(), z.unknown()),
    preview: z.string().max(4_000).optional(),
  }),
  z.object({
    type: z.literal("run_complete"),
    runId: z.string().min(1),
    status: z.enum(["done", "failed", "canceled"]),
    resultSummary: z.string().max(8_000).optional(),
    agentMinutes: z.number().nonnegative().max(100_000),
    tokenCost: z.number().int().nonnegative().max(1_000_000_000).optional(),
  }),
]);
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

// ── Dispatch result (returned by dispatchUserGoal) ──────────────────────────────────────
export type DispatchOutcome =
  // The goal was simple enough to skip scaffolding; nothing was dispatched.
  | { kind: "simple"; reason: string }
  // A run was created. `dispatched` is false when the runtime isn't configured yet (the run
  // is persisted in 'planning' and the scaffold is shown, but no Modal job fired).
  | {
      kind: "dispatched";
      runId: string;
      scaffold: Scaffold;
      dispatched: boolean;
      reason: string;
    }
  // The tier cap refused the run.
  | { kind: "capped"; reason: string }
  // The cost budget is at 80%+ (not yet acknowledged this period). The dispatcher PAUSED instead of
  // firing (PA-COST-14): the surface shows the three-button choice (keep going / pause / raise the cap)
  // and the owner answers via /api/app/budget/decision before the goal is re-issued. Chat is exempt.
  | {
      kind: "budget_warn";
      reason: string;
      spentMicroCents: number;
      budgetCents: number;
      pct: number;
    }
  // The cost budget is at 100%+ (or the owner paused for the period). The dispatcher staged a
  // cost_budget_gate Mission Control card instead of firing; `inboxItemId` is null only if staging failed.
  | {
      kind: "budget_gated";
      reason: string;
      inboxItemId: string | null;
      spentMicroCents: number;
      budgetCents: number;
      pct: number;
    }
  // The Gate Phase held the plan (PA-GATE-1): one or more gates flagged or blocked it. The run is
  // persisted + paused; a gate_findings Inbox card is staged for the owner. `verdict` is 'flagged'
  // (≥1 flag) or 'blocked' (≥1 hard_fail/error, fail-closed). `inboxItemId` keys the review card.
  | {
      kind: "gated";
      runId: string;
      scaffold: Scaffold;
      verdict: "flagged" | "blocked";
      inboxItemId: string;
      passed: number;
      total: number;
      reason: string;
    }
  // The orchestrator is disabled by flag.
  | { kind: "disabled"; reason: string };

// ── Agent-minute estimation ─────────────────────────────────────────────────────────────
/**
 * Reserve-ahead estimate (in agent-minutes) for a scaffold, used by the atomic cap check at
 * dispatch. We reserve the full time budget per leaf task so two concurrent dispatches can't
 * both squeak past the cap; the run reconciles to actuals on completion. One "leaf" = one
 * sub-agent that runs for up to `budgetSeconds`.
 */
export function estimateAgentMinutes(scaffold: Scaffold, budgetSeconds: number): number {
  const leafCount = scaffold.milestones.reduce((n, m) => n + m.tasks.length, 0);
  const minutesPerLeaf = budgetSeconds / 60;
  // Round up to a tenth of a minute so tiny runs still meter something.
  return Math.max(0.1, Math.round(leafCount * minutesPerLeaf * 10) / 10);
}
