import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertPocketAgentAddonPurchase } from "@/lib/pocket-agent-supabase";
import { POCKET_CAPTURE_ADDON_KIND, POCKET_CAPTURE_PRICE_CENTS } from "../product";

// The webhook's Pocket Capture handler writes its entitlement row through insertPocketAgentAddonPurchase
// (the migration-065 ledger, reused). Idempotency across duplicate Stripe webhook deliveries is a
// property of THAT write: the request must target the stripe_session_id conflict key with a
// merge-duplicates resolution, so re-delivering the same completed checkout collapses to a no-op
// instead of inserting a second row. These tests pin that contract without touching a real database.

const ENV = {
  POCKET_AGENT_SUPABASE_URL: "https://proj.supabase.co",
  POCKET_AGENT_SUPABASE_SERVICE_KEY: "service-role-key",
};

const purchase = {
  userId: null,
  email: "buyer@example.com",
  kind: POCKET_CAPTURE_ADDON_KIND,
  stripeSessionId: "cs_test_dup_123",
  stripeCustomerId: "cus_1",
  stripePaymentIntentId: "pi_1",
  amountCents: POCKET_CAPTURE_PRICE_CENTS,
};

describe("Pocket Capture ledger insert idempotency", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("upserts on stripe_session_id with merge-duplicates so re-deliveries are no-ops", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response("", { status: 201 });
      }),
    );

    // Two deliveries of the same completed checkout (Stripe retries).
    const first = await insertPocketAgentAddonPurchase(purchase);
    const second = await insertPocketAgentAddonPurchase(purchase);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(calls).toHaveLength(2);

    for (const { url, init } of calls) {
      // The conflict target is the unique session id — the idempotency key.
      expect(url).toContain("pocket_agent_addon_purchases");
      expect(url).toContain("on_conflict=stripe_session_id");
      const prefer = new Headers(init.headers).get("Prefer") ?? "";
      expect(prefer).toContain("resolution=merge-duplicates");
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(body.kind).toBe("pocket_capture_standalone");
      expect(body.stripe_session_id).toBe("cs_test_dup_123");
      expect(body.amount_cents).toBe(4_700);
    }

    // Both deliveries send byte-identical rows, so the merge is a true no-op on the second.
    expect(String(calls[0].init.body)).toBe(String(calls[1].init.body));
  });
});
