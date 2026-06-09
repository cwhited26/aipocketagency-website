// Unit tests for the cost ledger writer (lib/cost/log). The insert path runs against a mocked global
// fetch so the PostgREST request shape is pinned without touching Supabase; the duplicate-idempotency
// swallow is asserted (a 23505 / 409 must resolve silently — that's the idempotency guard working, not
// an error); and the append-only + owner-reads-own RLS guarantee is pinned structurally against the
// migration so a future edit can't loosen it (a true RLS round-trip needs a live Postgres).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logCostEvent, logCostFromUsage } from "../log";

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
  it("POSTs one row to pa_cost_events with the right shape", async () => {
    const { calls } = mockFetch(201);
    await logCostEvent({
      ownerId: "owner-1",
      featureSlug: "lead_scout",
      backend: "anthropic",
      model: "claude-sonnet-4-6",
      costCents: 3.7,
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
    // Fractional cents round to the integer column.
    expect(row.unit_cost_cents).toBe(4);
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
      costCents: 1,
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
      logCostEvent({ ownerId: "o", featureSlug: "chat", backend: "anthropic", costCents: 1, idempotencyKey: "dup" }),
    ).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("swallows a 23505 unique-violation body without warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch(400, 'duplicate key value violates unique constraint (23505)');
    await logCostEvent({ ownerId: "o", featureSlug: "chat", backend: "anthropic", costCents: 1, idempotencyKey: "dup" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns on a non-duplicate rejection", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch(500, "internal error");
    await logCostEvent({ ownerId: "o", featureSlug: "chat", backend: "anthropic", costCents: 1, idempotencyKey: "x" });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("logCostFromUsage", () => {
  it("prices the usage and forwards token counts to the ledger", async () => {
    const { calls } = mockFetch(201);
    await logCostFromUsage(
      { ownerId: "owner-2", featureSlug: "youtube", idempotencyKey: "yt:1" },
      "anthropic",
      "claude-sonnet-4-6",
      { tokensInput: 1_000_000, tokensOutput: 0 },
    );
    const row = JSON.parse(String(calls[0].init.body));
    // 1M sonnet input = $3 = 300 cents.
    expect(row.unit_cost_cents).toBe(300);
    expect(row.tokens_input).toBe(1_000_000);
    expect(row.backend).toBe("anthropic");
    expect(row.feature_slug).toBe("youtube");
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
