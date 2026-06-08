import { describe, it, expect } from "vitest";
import { projectMissionControl, type ProjectionRoutine } from "../projection";
import type { SubAgentRunRow } from "@/lib/orchestrator/types";

const NOW = Date.parse("2026-06-08T18:00:00.000Z");

function run(overrides: Partial<SubAgentRunRow>): SubAgentRunRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    business_id: "biz",
    originating_message_id: null,
    status: "running",
    spec_json: { objective: "Send the follow-ups" },
    tool_scopes: [],
    time_budget_seconds: 300,
    started_at: new Date(NOW - 60_000).toISOString(),
    phase_progress: {},
    result_summary: null,
    token_cost: 0,
    agent_minutes: 0,
    created_at: new Date(NOW - 120_000).toISOString(),
    updated_at: new Date(NOW - 30_000).toISOString(),
    last_heartbeat_at: new Date(NOW - 10_000).toISOString(),
    retries_used: 1,
    retry_budget: 5,
    verification_verdict: null,
    needs_human: false,
    ...overrides,
  };
}

const routine = (over: Partial<ProjectionRoutine> = {}): ProjectionRoutine => ({
  kind: "daily_brief",
  enabled: true,
  next_run_at: new Date(NOW + 3_600_000).toISOString(),
  schedule_cron: "0 8 * * *",
  ...over,
});

describe("projectMissionControl bucketing", () => {
  it("places a live run in Active and computes idle = cap − active", () => {
    const snap = projectMissionControl({
      runs: [run({ id: "a" })],
      routines: [],
      concurrencyCap: 5,
      nowMs: NOW,
    });
    expect(snap.active.map((e) => e.id)).toEqual(["a"]);
    expect(snap.counts.active).toBe(1);
    expect(snap.counts.idle).toBe(4);
    expect(snap.active[0].retryBudget).toBe(5);
    expect(snap.active[0].slot).toMatch(/^slot /);
  });

  it("routes zombie, recent-failure, and needs_human runs to Attention", () => {
    const snap = projectMissionControl({
      runs: [
        run({ id: "z", status: "zombie" }),
        run({ id: "f", status: "failed", updated_at: new Date(NOW - 1_000).toISOString() }),
        run({ id: "h", status: "paused", needs_human: true }),
      ],
      routines: [],
      concurrencyCap: 5,
      nowMs: NOW,
    });
    expect(snap.attention.map((e) => e.id).sort()).toEqual(["f", "h", "z"]);
    expect(snap.counts.attention).toBe(3);
    expect(snap.attention.find((e) => e.id === "z")?.ledgerStatus).toBe("zombie");
    expect(snap.attention.find((e) => e.id === "h")?.ledgerStatus).toBe("blocked");
  });

  it("treats a run in the verify phase as Verifying", () => {
    const snap = projectMissionControl({
      runs: [run({ id: "v", status: "running", phase_progress: { currentPhase: "verify" } })],
      routines: [],
      concurrencyCap: 5,
      nowMs: NOW,
    });
    expect(snap.verifying.map((e) => e.id)).toEqual(["v"]);
    expect(snap.counts.active).toBe(0);
    expect(snap.counts.verifying).toBe(1);
  });

  it("keeps recent done runs but drops stale failures and canceled runs", () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const snap = projectMissionControl({
      runs: [
        run({ id: "d", status: "done", updated_at: new Date(NOW - 1_000).toISOString() }),
        run({ id: "old", status: "failed", updated_at: new Date(NOW - dayMs - 1_000).toISOString() }),
        run({ id: "c", status: "canceled" }),
      ],
      routines: [],
      concurrencyCap: 5,
      nowMs: NOW,
    });
    expect(snap.recentlyDone.map((e) => e.id)).toEqual(["d"]);
    expect(snap.attention).toHaveLength(0);
    expect(snap.counts.done).toBe(1);
  });

  it("lists enabled routines with a next run in Scheduled, sorted soonest-first", () => {
    const snap = projectMissionControl({
      runs: [],
      routines: [
        routine({ kind: "weekly_digest", next_run_at: new Date(NOW + 7_200_000).toISOString() }),
        routine({ kind: "daily_brief", next_run_at: new Date(NOW + 1_800_000).toISOString() }),
        routine({ kind: "followup_sweep", enabled: false }),
      ],
      concurrencyCap: 5,
      nowMs: NOW,
    });
    expect(snap.scheduled.map((s) => s.kind)).toEqual(["daily_brief", "weekly_digest"]);
    expect(snap.counts.scheduled).toBe(2);
  });
});
