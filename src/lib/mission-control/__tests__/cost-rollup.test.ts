// Unit tests for the Cost tab aggregation (lib/mission-control/cost-rollup). Pins the pure fold —
// the three tiles, the spend-over-time line bucketing, the three breakdowns (feature/model/backend),
// and the empty state — plus getCostRollup's loader wiring + 8s per-owner+period cache. Storage is
// MICRO-CENTS throughout (PA-COST-9); the fold never rounds to cents.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __clearCostRollupCache,
  getCostRollup,
  isCostPeriod,
  periodStartMs,
  rollupCostEvents,
  type CostEventRow,
} from "../cost-rollup";

// Fixed clock: mid-month so Month = Jun 1 → Jun 15 (15 daily buckets), Week = Jun 9 → Jun 15 (7).
const NOW = Date.parse("2026-06-15T12:00:00Z");

function ev(over: Partial<CostEventRow>): CostEventRow {
  return {
    feature_slug: "chat",
    backend: "anthropic",
    model: "claude-sonnet-4-6",
    cost_micro_cents: 0,
    tokens_input: null,
    tokens_output: null,
    created_at: "2026-06-10T09:00:00Z",
    metadata: {},
    ...over,
  };
}

// A realistic mixed batch inside the month window.
const FIXTURE: CostEventRow[] = [
  ev({ feature_slug: "chat", backend: "anthropic", model: "claude-sonnet-4-6", cost_micro_cents: 6000, tokens_input: 1000, tokens_output: 200, created_at: "2026-06-02T09:00:00Z", metadata: { conversation_id: "c1" } }),
  ev({ feature_slug: "chat", backend: "anthropic", model: "claude-sonnet-4-6", cost_micro_cents: 6000, tokens_input: 1000, tokens_output: 200, created_at: "2026-06-02T11:00:00Z", metadata: { conversation_id: "c1" } }),
  ev({ feature_slug: "lead_scout", backend: "bright_data", model: null, cost_micro_cents: 3000, created_at: "2026-06-10T09:00:00Z", metadata: { sub_agent_run_id: "r1" } }),
  ev({ feature_slug: "lead_scout", backend: "anthropic", model: "claude-haiku-4-5", cost_micro_cents: 800, tokens_input: 500, tokens_output: 100, created_at: "2026-06-10T10:00:00Z", metadata: { sub_agent_run_id: "r1" } }),
  ev({ feature_slug: "podcast", backend: "openai", model: "whisper-1", cost_micro_cents: 60000, created_at: "2026-06-14T08:00:00Z", metadata: { sub_agent_run_id: "r2" } }),
];

describe("rollupCostEvents — tiles", () => {
  it("totals spend in micro-cents, tokens, and turns (distinct conversations + sub-agent runs)", () => {
    const r = rollupCostEvents(FIXTURE, { period: "month", nowMs: NOW });
    expect(r.tiles.totalSpendMicroCents).toBe(75_800); // 6000+6000+3000+800+60000
    expect(r.tiles.totalTokens).toBe(3000); // 1200 + 1200 + 600
    // turns = distinct conversation_id {c1} (1) + distinct sub_agent_run_id {r1,r2} (2) = 3
    expect(r.tiles.turnsRecorded).toBe(3);
    expect(r.empty).toBe(false);
  });
});

describe("rollupCostEvents — spend-over-time line", () => {
  it("buckets daily across the month-to-date window and assigns spend to the right day", () => {
    const r = rollupCostEvents(FIXTURE, { period: "month", nowMs: NOW });
    expect(r.period).toBe("month");
    expect(r.periodStart).toBe("2026-06-01T00:00:00.000Z");
    expect(r.line).toHaveLength(15); // Jun 1 .. Jun 15 inclusive
    const byLabel = Object.fromEntries(r.line.map((b) => [b.label, b.spendMicroCents]));
    expect(byLabel["Jun 2"]).toBe(12_000);
    expect(byLabel["Jun 10"]).toBe(3_800);
    expect(byLabel["Jun 14"]).toBe(60_000);
    // The line totals to the same spend as the tile — nothing falls outside a bucket.
    expect(r.line.reduce((a, b) => a + b.spendMicroCents, 0)).toBe(r.tiles.totalSpendMicroCents);
  });

  it("buckets hourly for the Day period", () => {
    const r = rollupCostEvents(FIXTURE, { period: "day", nowMs: NOW });
    // Jun 15 00:00 .. 12:00 = 13 hourly buckets; no fixture events today, so all zero.
    expect(r.line).toHaveLength(13);
    expect(r.line[0].label).toBe("00:00");
    expect(r.empty).toBe(true);
  });
});

describe("rollupCostEvents — breakdowns", () => {
  it("leads with feature area, sorted by spend descending (PA-COST-5)", () => {
    const r = rollupCostEvents(FIXTURE, { period: "month", nowMs: NOW });
    expect(r.byFeature.map((x) => [x.label, x.spendMicroCents, x.events])).toEqual([
      ["Podcast", 60_000, 1],
      ["Chat", 12_000, 2],
      ["Lead Scout", 3_800, 2],
    ]);
  });

  it("breaks down by backend", () => {
    const r = rollupCostEvents(FIXTURE, { period: "month", nowMs: NOW });
    expect(r.byBackend.map((x) => [x.label, x.spendMicroCents, x.events])).toEqual([
      ["OpenAI", 60_000, 1],
      ["Anthropic", 12_800, 3],
      ["Bright Data", 3_000, 1],
    ]);
  });

  it("breaks down by model and groups null-model flat-rate events without dropping their spend", () => {
    const r = rollupCostEvents(FIXTURE, { period: "month", nowMs: NOW });
    expect(r.byModel.map((x) => [x.label, x.spendMicroCents])).toEqual([
      ["whisper-1", 60_000],
      ["claude-sonnet-4-6", 12_000],
      ["Flat-rate calls", 3_000],
      ["claude-haiku-4-5", 800],
    ]);
    // The by-model breakdown totals to the same spend as the other two.
    expect(r.byModel.reduce((a, b) => a + b.spendMicroCents, 0)).toBe(75_800);
  });
});

describe("rollupCostEvents — empty state", () => {
  it("flags empty, zeroes the tiles, and still returns a contiguous (zero) line", () => {
    const r = rollupCostEvents([], { period: "month", nowMs: NOW });
    expect(r.empty).toBe(true);
    expect(r.tiles).toEqual({ totalSpendMicroCents: 0, totalTokens: 0, turnsRecorded: 0 });
    expect(r.line).toHaveLength(15);
    expect(r.line.every((b) => b.spendMicroCents === 0)).toBe(true);
    expect(r.byFeature).toEqual([]);
    expect(r.byModel).toEqual([]);
    expect(r.byBackend).toEqual([]);
  });

  it("drops events that fall outside the period window", () => {
    const stale = [ev({ cost_micro_cents: 9999, created_at: "2026-05-20T09:00:00Z" })]; // last month
    const r = rollupCostEvents(stale, { period: "month", nowMs: NOW });
    expect(r.empty).toBe(true);
    expect(r.tiles.totalSpendMicroCents).toBe(0);
  });
});

describe("period helpers", () => {
  it("validates the period query param", () => {
    expect(isCostPeriod("month")).toBe(true);
    expect(isCostPeriod("week")).toBe(true);
    expect(isCostPeriod("day")).toBe(true);
    expect(isCostPeriod("year")).toBe(false);
  });

  it("anchors the window to UTC day boundaries", () => {
    expect(new Date(periodStartMs("month", NOW)).toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(new Date(periodStartMs("week", NOW)).toISOString()).toBe("2026-06-09T00:00:00.000Z");
    expect(new Date(periodStartMs("day", NOW)).toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });
});

describe("getCostRollup — loader wiring + cache", () => {
  beforeEach(() => __clearCostRollupCache());

  it("passes the period window start to the loader and folds the result", async () => {
    const loadEvents = vi.fn(async () => FIXTURE);
    const r = await getCostRollup({ ownerId: "owner-A", period: "month", nowMs: NOW, loadEvents });
    expect(loadEvents).toHaveBeenCalledWith({ ownerId: "owner-A", sinceIso: "2026-06-01T00:00:00.000Z" });
    expect(r.tiles.totalSpendMicroCents).toBe(75_800);
  });

  it("serves a second call within the 8s TTL from cache (one ledger read)", async () => {
    const loadEvents = vi.fn(async () => FIXTURE);
    await getCostRollup({ ownerId: "owner-B", period: "month", nowMs: NOW, loadEvents });
    await getCostRollup({ ownerId: "owner-B", period: "month", nowMs: NOW + 4000, loadEvents });
    expect(loadEvents).toHaveBeenCalledTimes(1);
  });

  it("re-reads after the TTL expires", async () => {
    const loadEvents = vi.fn(async () => FIXTURE);
    await getCostRollup({ ownerId: "owner-C", period: "month", nowMs: NOW, loadEvents });
    await getCostRollup({ ownerId: "owner-C", period: "month", nowMs: NOW + 9000, loadEvents });
    expect(loadEvents).toHaveBeenCalledTimes(2);
  });

  it("caches per period — Day and Month don't share a slot", async () => {
    const loadEvents = vi.fn(async () => FIXTURE);
    await getCostRollup({ ownerId: "owner-D", period: "month", nowMs: NOW, loadEvents });
    await getCostRollup({ ownerId: "owner-D", period: "day", nowMs: NOW, loadEvents });
    expect(loadEvents).toHaveBeenCalledTimes(2);
  });
});
