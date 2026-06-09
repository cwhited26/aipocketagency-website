// Unit tests for the cost ledger writer (lib/cost/log). The insert path runs against a mocked global
// fetch so the PostgREST request shape is pinned without touching Supabase; the duplicate-idempotency
// swallow is asserted (a 23505 / 409 must resolve silently — that's the idempotency guard working, not
// an error); the append-only + owner-reads-own RLS guarantee is pinned structurally against migration
// 053; and migration 056's MICRO-CENTS conversion (BIGINT cost_micro_cents + the generated unit_cost_cents
// backward-compat column) is pinned so sub-cent events stay lossless instead of rounding to zero.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logCostEvent, logCostFromUsage } from "../log";
import { getCostMicroCents } from "../prices";

const ENV_KEYS = ["POCKET_AGENT_SUPABASE_URL", "POCKET_AGENT_SUPABASE_SERVICE_KEY"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  process.env.POCKET_AGENT_SUPABASE_URL = "https://test.supabase.co";
  process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY = "service-role-key";
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

type CapturedRequest = { url: string; init: RequestInit };

function mockFetch(status: number, body = ""): { calls: CapturedRequest[] } {
  const calls: CapturedRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(body, { status });
    }),
  );
  return { calls };
}

describe("logCostEvent — insert", () => {
  it("POSTs one row to pa_cost_events storing cost_micro_cents, not the generated unit_cost_cents", async () => {
    const { calls } = mockFetch(201);
    await logCostEvent({
      ownerId: "owner-1",
      featureSlug: "lead_scout",
      backend: "anthropic",
      model: "claude-sonnet-4-6",
      // A fractional sub-cent realized cost (637.4 micro-cents = 0.06374 cent) that rounded to ZERO under
      // the old INTEGER-cents column — 056 keeps it.
      costMicroCents: 637.4,
      tokensInput: 1200,
      tokensOutput: 300,
      idempotencyKey: "run-1:url-a:extract",
      subAgentRunId: "run-1",
      conversationId: "conv-9",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://test.supabase.co/rest/v1/pa_cost_events");
    expect(calls[0].init.method).toBe("POST");
    const row = JSON.parse(String(calls[0].init.body));
    expect(row.owner_id).toBe("owner-1");
    expect(row.feature_slug).toBe("lead_scout");
    expect(row.backend).toBe("anthropic");
    expect(row.model).toBe("claude-sonnet-4-6");
    // Fractional micro-cents round to the integer BIGINT column (637.4 → 637) — NOT to whole cents.
    expect(row.cost_micro_cents).toBe(637);
    // unit_cost_cents is GENERATED in Postgres (056); the writer must never send it.
    expect(row.unit_cost_cents).toBeUndefined();
    expect(row.tokens_input).toBe(1200);
    expect(row.tokens_output).toBe(300);
    expect(row.metadata).toEqual({
      idempotency_key: "run-1:url-a:extract",
      sub_agent_run_id: "run-1",
      conversation_id: "conv-9",
    });
  });

  it("drops the event (no fetch) and warns when service-role env is missing", async () => {
    delete process.env.POCKET_AGENT_SUPABASE_URL;
    delete process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { calls } = mockFetch(201);
    await logCostEvent({
      ownerId: "owner-1",
      featureSlug: "chat",
      backend: "anthropic",
      costMicroCents: 10000,
      idempotencyKey: "k",
    });
    expect(calls).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("logCostEvent — idempotency swallow", () => {
  it("swallows a 409 duplicate-key response without warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch(409, "duplicate key");
    await expect(
      logCostEvent({ ownerId: "o", featureSlug: "chat", backend: "anthropic", costMicroCents: 10000, idempotencyKey: "dup" }),
    ).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("swallows a 23505 unique-violation body without warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch(400, "duplicate key value violates unique constraint (23505)");
    await logCostEvent({ ownerId: "o", featureSlug: "chat", backend: "anthropic", costMicroCents: 10000, idempotencyKey: "dup" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns on a non-duplicate rejection", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch(500, "internal error");
    await logCostEvent({ ownerId: "o", featureSlug: "chat", backend: "anthropic", costMicroCents: 10000, idempotencyKey: "x" });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("logCostFromUsage", () => {
  it("prices the usage in micro-cents and forwards token counts to the ledger", async () => {
    const { calls } = mockFetch(201);
    await logCostFromUsage(
      { ownerId: "owner-2", featureSlug: "youtube", idempotencyKey: "yt:1" },
      "anthropic",
      "claude-sonnet-4-6",
      { tokensInput: 1_000_000, tokensOutput: 0 },
    );
    const row = JSON.parse(String(calls[0].init.body));
    // 1M sonnet input = $3 = 3,000,000 micro-cents.
    expect(row.cost_micro_cents).toBe(3_000_000);
    expect(row.unit_cost_cents).toBeUndefined();
    expect(row.tokens_input).toBe(1_000_000);
    expect(row.backend).toBe("anthropic");
    expect(row.feature_slug).toBe("youtube");
  });

  it("keeps a single sub-cent Bright Data request lossless (3,000 micro-cents, not 0)", async () => {
    const { calls } = mockFetch(201);
    await logCostFromUsage(
      { ownerId: "owner-3", featureSlug: "lead_scout", idempotencyKey: "ls:1" },
      "bright_data",
      null,
      { requests: 1 },
    );
    const row = JSON.parse(String(calls[0].init.body));
    // 1 request = 0.3 cent = 3,000 micro-cents. The old INTEGER-cents path stored Math.round(0.3) = 0.
    expect(row.cost_micro_cents).toBe(3000);
  });
});

describe("micro-cents vs integer-cents aggregation — lossless precision (PA-COST-9)", () => {
  it("integer-cents storage under-reports a sub-cent-heavy ledger; micro-cents is exact", () => {
    // A realistic mixed batch the Phase-1 backends fire: lots of cheap sub-cent calls + a few bigger ones.
    const haiku = getCostMicroCents("anthropic", "claude-haiku-4-5", { tokensInput: 500, tokensOutput: 100 }); // 800 µ¢ (0.08¢)
    const bright = getCostMicroCents("bright_data", null, { requests: 1 }); // 3,000 µ¢ (0.3¢)
    const sonnet = getCostMicroCents("anthropic", "claude-sonnet-4-6", { tokensInput: 2000, tokensOutput: 500 }); // 13,500 µ¢ (1.35¢)
    const ledger = [
      ...Array.from({ length: 50 }, () => haiku),
      ...Array.from({ length: 30 }, () => bright),
      ...Array.from({ length: 5 }, () => sonnet),
    ];

    // New path: store micro-cents, aggregate as pure integer math, convert to cents only at the end.
    const microTotal = ledger.reduce((acc, m) => acc + Math.round(m), 0);
    const microTotalCents = microTotal / 10000;

    // Old path: each event rounded to whole cents on write (Math.round(micro / 10000)), then summed.
    const integerTotalCents = ledger.reduce((acc, m) => acc + Math.round(m / 10000), 0);

    // 50*800 + 30*3000 + 5*13500 = 40,000 + 90,000 + 67,500 = 197,500 µ¢ = 19.75¢ (lossless).
    expect(microTotal).toBe(197_500);
    expect(microTotalCents).toBeCloseTo(19.75, 6);
    // Every sub-cent event (Haiku 0.08¢, Bright 0.3¢) rounded to 0; only the 5 Sonnet calls (1.35¢→1¢)
    // survived → the integer ledger reports just 5¢.
    expect(integerTotalCents).toBe(5);
    // The integer column under-reports true spend by 14.75¢ on this dataset (≈75% of it vanishes).
    expect(microTotalCents - integerTotalCents).toBeCloseTo(14.75, 6);
    expect(integerTotalCents).toBeLessThan(microTotalCents);
  });
});

describe("migration 053 — append-only + owner-reads-own RLS", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/053_cost_observability.sql"),
    "utf-8",
  );

  it("enables RLS on the ledger", () => {
    expect(sql).toMatch(/ALTER TABLE pa_cost_events ENABLE ROW LEVEL SECURITY/);
  });

  it("scopes the only read policy to the owner (cross-owner reads denied)", () => {
    expect(sql).toMatch(/CREATE POLICY pa_cost_events_owner_read ON pa_cost_events\s+FOR SELECT USING \(owner_id = auth\.uid\(\)\)/);
  });

  it("grants no insert/update/delete policy on the ledger (append-only for non-service roles)", () => {
    // The service role bypasses RLS to write; the absence of these policies is what makes the ledger
    // append-only + read-only for every owner.
    expect(sql).not.toMatch(/ON pa_cost_events\s+FOR (INSERT|UPDATE|DELETE|ALL)/);
  });

  it("guards idempotency with a unique partial index on the idempotency key", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX[^;]*idx_pa_cost_events_idem[\s\S]*metadata->>'idempotency_key'/);
  });

  it("keeps one active budget per owner", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX[^;]*idx_pa_cost_budgets_owner_active[\s\S]*WHERE status = 'active'/);
  });
});

describe("migration 056 — micro-cents precision conversion (PA-COST-9)", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/056_cost_observability_micro_cents.sql"),
    "utf-8",
  );

  it("adds the lossless BIGINT micro-cents column", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS cost_micro_cents BIGINT NOT NULL DEFAULT 0/);
  });

  it("backfills micro-cents from the existing integer cents (× 10,000)", () => {
    expect(sql).toMatch(/SET cost_micro_cents = unit_cost_cents::BIGINT \* 10000/);
  });

  it("converts unit_cost_cents to a generated floor(micro/10000) backward-compat column", () => {
    expect(sql).toMatch(/unit_cost_cents INTEGER\s+GENERATED ALWAYS AS \(FLOOR\(cost_micro_cents \/ 10000\)::INTEGER\) STORED/);
  });

  it("guards the conversion on is_generated so a re-run is a no-op (idempotent)", () => {
    expect(sql).toMatch(/is_generated = 'NEVER'/);
  });

  it("models the generated column formula: unit_cost_cents = floor(micro / 10000)", () => {
    // Pin the SQL FLOOR(cost_micro_cents / 10000) semantics the readers-not-yet-migrated rely on. A
    // 637-µ¢ event (0.0637¢) floors to 0¢; a 13,500-µ¢ event (1.35¢) floors to 1¢.
    const floorCents = (micro: number) => Math.floor(micro / 10000);
    expect(floorCents(637)).toBe(0);
    expect(floorCents(3000)).toBe(0);
    expect(floorCents(13_500)).toBe(1);
    expect(floorCents(197_500)).toBe(19);
  });
});
