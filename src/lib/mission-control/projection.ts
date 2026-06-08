// projection.ts — the pure Mission Control projection (PA-MC-2, PA-MC-3).
//
// Takes the raw sub-agent runs + scheduled routines + the owner's concurrency cap and folds them
// into one urgency-first snapshot: the six header counts and the section entries the surface
// renders. Pure (no I/O), so the bucketing rules are unit-tested in isolation and the API route
// is a thin fetch-then-project shell. Mirrors the FerroxLabs Mission Control shape (a normalized
// ledger + a counts projection) but with PA's own status vocabulary and sections.

import {
  SubAgentSpecSchema,
  type SubAgentRunRow,
  type VerificationVerdict,
} from "@/lib/orchestrator/types";
import { ROUTINE_DEFS, type RoutineKind } from "@/lib/routine-meta";

// The Mission Control ledger status — a derived view over the run's DB status + phase + flags.
// Distinct from the DB run status: 'blocked' here means needs_human, 'idle' is a count-only tile.
export type LedgerStatus =
  | "running"
  | "verifying"
  | "blocked"
  | "zombie"
  | "failed"
  | "done";

export type RunLedgerEntry = {
  id: string;
  title: string;
  ledgerStatus: LedgerStatus;
  /** The sub-agent slot this run occupies — a short, stable handle off the run id. */
  slot: string;
  /** Current phase of the 7-phase Algorithm, when the run is mid-flight. */
  phase: string | null;
  lastHeartbeatAt: string | null;
  retriesUsed: number | null;
  retryBudget: number | null;
  needsHuman: boolean;
  verificationVerdict: VerificationVerdict | null;
  resultSummary: string | null;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScheduledEntry = {
  kind: string;
  label: string;
  nextRunAt: string;
  scheduleCron: string;
};

export type MissionControlCounts = {
  attention: number;
  active: number;
  verifying: number;
  scheduled: number;
  done: number;
  idle: number;
};

export type MissionControlSnapshot = {
  generatedAt: string;
  counts: MissionControlCounts;
  attention: RunLedgerEntry[];
  active: RunLedgerEntry[];
  verifying: RunLedgerEntry[];
  scheduled: ScheduledEntry[];
  recentlyDone: RunLedgerEntry[];
};

export type ProjectionRoutine = {
  kind: string;
  enabled: boolean;
  next_run_at: string | null;
  schedule_cron: string;
};

export type ProjectionInput = {
  runs: SubAgentRunRow[];
  routines: ProjectionRoutine[];
  /** Concurrency cap = how many sub-agent slots the owner may hold at once. Idle = cap − active. */
  concurrencyCap: number;
  nowMs: number;
};

const DONE_WINDOW_MS = 24 * 60 * 60 * 1000; // recently-done runs stay visible for 24h
const FAILED_WINDOW_MS = 24 * 60 * 60 * 1000; // unresolved failures stay in Attention for 24h
const TITLE_MAX = 96;

const LIVE_STATUSES = new Set(["planning", "running", "paused"]);

function currentPhase(phaseProgress: unknown): string | null {
  if (phaseProgress && typeof phaseProgress === "object" && "currentPhase" in phaseProgress) {
    const p = (phaseProgress as { currentPhase: unknown }).currentPhase;
    return typeof p === "string" && p.length > 0 ? p : null;
  }
  return null;
}

function runTitle(run: SubAgentRunRow): string {
  const spec = SubAgentSpecSchema.safeParse(run.spec_json);
  const objective = spec.success ? spec.data.objective.trim() : "";
  const base = objective || run.result_summary?.trim() || "Sub-agent run";
  return base.length > TITLE_MAX ? `${base.slice(0, TITLE_MAX).trimEnd()}…` : base;
}

function toEntry(run: SubAgentRunRow, ledgerStatus: LedgerStatus): RunLedgerEntry {
  return {
    id: run.id,
    title: runTitle(run),
    ledgerStatus,
    slot: `slot ${run.id.slice(0, 4)}`,
    phase: currentPhase(run.phase_progress),
    lastHeartbeatAt: run.last_heartbeat_at ?? null,
    retriesUsed: run.retries_used ?? null,
    retryBudget: run.retry_budget ?? null,
    needsHuman: run.needs_human ?? false,
    verificationVerdict: run.verification_verdict ?? null,
    resultSummary: run.result_summary,
    startedAt: run.started_at,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  };
}

function ageMs(iso: string, nowMs: number): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? nowMs - t : Number.POSITIVE_INFINITY;
}

/**
 * Fold runs + routines into the urgency-first snapshot. A run lands in exactly one section,
 * decided in priority order: Attention (zombie / recent-or-flagged failure / needs_human) →
 * Verifying → Active → recently Done. Stale failures and finished/canceled runs outside the
 * windows drop off so the live pane stays the live pane.
 */
export function projectMissionControl(input: ProjectionInput): MissionControlSnapshot {
  const { runs, routines, concurrencyCap, nowMs } = input;

  const attention: RunLedgerEntry[] = [];
  const active: RunLedgerEntry[] = [];
  const verifying: RunLedgerEntry[] = [];
  const recentlyDone: RunLedgerEntry[] = [];

  for (const run of runs) {
    const phase = currentPhase(run.phase_progress);
    const needsHuman = run.needs_human ?? false;
    const isLive = LIVE_STATUSES.has(run.status);

    if (run.status === "zombie") {
      attention.push(toEntry(run, "zombie"));
    } else if (run.status === "failed" && (needsHuman || ageMs(run.updated_at, nowMs) <= FAILED_WINDOW_MS)) {
      attention.push(toEntry(run, "failed"));
    } else if (needsHuman && (isLive || run.status === "verifying")) {
      attention.push(toEntry(run, "blocked"));
    } else if (run.status === "verifying" || (isLive && phase === "verify")) {
      verifying.push(toEntry(run, "verifying"));
    } else if (isLive) {
      active.push(toEntry(run, "running"));
    } else if (run.status === "done" && ageMs(run.updated_at, nowMs) <= DONE_WINDOW_MS) {
      recentlyDone.push(toEntry(run, "done"));
    }
    // failed-outside-window, canceled, and old done runs fall through to history (not shown live).
  }

  const scheduled: ScheduledEntry[] = routines
    .filter((r) => r.enabled && r.next_run_at)
    .map((r) => {
      const def = ROUTINE_DEFS[r.kind as RoutineKind];
      return {
        kind: r.kind,
        label: def?.label ?? r.kind,
        nextRunAt: r.next_run_at as string,
        scheduleCron: r.schedule_cron,
      };
    })
    .sort((a, b) => (a.nextRunAt < b.nextRunAt ? -1 : 1));

  const idle = Math.max(0, concurrencyCap - active.length);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    counts: {
      attention: attention.length,
      active: active.length,
      verifying: verifying.length,
      scheduled: scheduled.length,
      done: recentlyDone.length,
      idle,
    },
    attention,
    active,
    verifying,
    scheduled,
    recentlyDone,
  };
}
