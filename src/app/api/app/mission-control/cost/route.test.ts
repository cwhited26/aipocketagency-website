// E2E for GET /api/app/mission-control/cost. Drives the real route handler against a mocked Supabase
// auth + a mocked PostgREST read seeded with pa_cost_events rows, so the auth → service-role-read →
// fold → JSON path is pinned end to end. The aggregation math itself is unit-tested in
// lib/mission-control/__tests__/cost-rollup.test.ts; here we pin the route contract.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { __clearCostRollupCache, type CostEventRow } from "@/lib/mission-control/cost-rollup";

const h = vi.hoisted(() => ({ user: { id: "owner-route" } as { id: string } | null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
  }),
}));

const ENV_KEYS = ["POCKET_AGENT_SUPABASE_URL", "POCKET_AGENT_SUPABASE_SERVICE_KEY"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  __clearCostRollupCache();
  h.user = { id: "owner-route" };
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

function mockLedger(rows: CostEventRow[], status = 200): { calls: string[] } {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify(rows), { status });
    }),
  );
  return { calls };
}

// Events stamped "now" so they always land in the default Month window regardless of the run date.
function seedRows(): CostEventRow[] {
  const now = new Date().toISOString();
  return [
    { feature_slug: "chat", backend: "anthropic", model: "claude-sonnet-4-6", cost_micro_cents: 6000, tokens_input: 1000, tokens_output: 200, created_at: now, metadata: { conversation_id: "c1" } },
    { feature_slug: "podcast", backend: "openai", model: "whisper-1", cost_micro_cents: 60000, tokens_input: null, tokens_output: null, created_at: now, metadata: { sub_agent_run_id: "r1" } },
  ];
}

function req(period?: string): Request {
  const q = period ? `?period=${period}` : "";
  return new Request(`http://localhost/api/app/mission-control/cost${q}`);
}

describe("GET /api/app/mission-control/cost", () => {
  it("401s an unauthenticated request", async () => {
    h.user = null;
    mockLedger([]);
    const res = await GET(req("month"));
    expect(res.status).toBe(401);
  });

  it("scopes the ledger read to the caller and folds the seeded rows into tiles + breakdowns", async () => {
    const { calls } = mockLedger(seedRows());
    const res = await GET(req("month"));
    expect(res.status).toBe(200);

    // The read is owner-scoped (the service-role fold relies on this filter for RLS-equivalent scoping).
    expect(calls[0]).toContain("/rest/v1/pa_cost_events");
    expect(calls[0]).toContain("owner_id=eq.owner-route");

    const body = await res.json();
    expect(body.empty).toBe(false);
    expect(body.tiles.totalSpendMicroCents).toBe(66_000); // 6000 + 60000
    expect(body.tiles.totalTokens).toBe(1200);
    expect(body.tiles.turnsRecorded).toBe(2); // {c1} + {r1}
    expect(body.byFeature[0]).toMatchObject({ label: "Podcast", spendMicroCents: 60_000 });
    expect(body.byBackend.map((x: { label: string }) => x.label)).toEqual(["OpenAI", "Anthropic"]);
  });

  it("returns the empty-state shape when the owner has no events", async () => {
    mockLedger([]);
    const res = await GET(req("month"));
    const body = await res.json();
    expect(body.empty).toBe(true);
    expect(body.tiles.totalSpendMicroCents).toBe(0);
    expect(body.byFeature).toEqual([]);
  });

  it("defaults an unknown period to Month", async () => {
    mockLedger([]);
    const res = await GET(req("decade"));
    const body = await res.json();
    expect(body.period).toBe("month");
  });

  it("surfaces a ledger read failure as a 500 (no silent empty rollup)", async () => {
    mockLedger([], 500);
    const res = await GET(req("month"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
