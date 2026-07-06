// POST /api/workshop/registrations end to end with stubbed network: the checkout call creates a
// registration row (PostgREST insert) and a Stripe Checkout Session, and returns the hosted URL.

import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../registrations/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const REG_ROW = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: null,
  email: "buyer@example.com",
  name: "Dana",
  stripe_customer_id: null,
  stripe_session_id: null,
  chosen_slot_at: "2026-07-08T18:00:00.000Z",
  timezone: "America/Chicago",
  bump_selected: true,
  session_status: "registered",
  created_at: "2026-07-05T12:00:00.000Z",
};

function stubNetwork() {
  const calls: Array<{ url: string; body: string | null }> = [];
  vi.stubEnv("POCKET_AGENT_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("POCKET_AGENT_SUPABASE_SERVICE_KEY", "service-key");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: typeof init?.body === "string" ? init.body : null });
      if (url.includes("/rest/v1/pa_workshop_registrations")) {
        return new Response(JSON.stringify([REG_ROW]), { status: 201 });
      }
      if (url.includes("api.stripe.com/v1/checkout/sessions")) {
        return new Response(
          JSON.stringify({
            id: "cs_test_1",
            url: "https://checkout.stripe.com/c/pay/cs_test_1",
            customer: null,
            subscription: null,
            metadata: {},
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 404 });
    }),
  );
  return calls;
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/workshop/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/workshop/registrations", () => {
  it("creates the registration row and the Stripe session, returns the checkout URL", async () => {
    const calls = stubNetwork();
    const slot = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await POST(
      request({ email: "buyer@example.com", name: "Dana", slot_at: slot, timezone: "America/Chicago", bump: true }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { registration_id: string; checkout_url: string };
    expect(data.registration_id).toBe(REG_ROW.id);
    expect(data.checkout_url).toContain("checkout.stripe.com");

    const insert = calls.find((c) => c.url.includes("pa_workshop_registrations"))!;
    expect(JSON.parse(insert.body!)).toMatchObject({
      email: "buyer@example.com",
      timezone: "America/Chicago",
      bump_selected: true,
    });

    const stripe = calls.find((c) => c.url.includes("checkout/sessions"))!;
    const params = new URLSearchParams(stripe.body!);
    expect(params.get("mode")).toBe("subscription");
    expect(params.get("subscription_data[trial_period_days]")).toBe("30");
    expect(params.get("metadata[registration_id]")).toBe(REG_ROW.id);
    expect(params.get("subscription_data[add_invoice_items][0][price_data][unit_amount]")).toBe("9700");
    expect(params.get("subscription_data[add_invoice_items][1][price_data][unit_amount]")).toBe("2700");
  });

  it("rejects a past slot with 422 and never touches the network", async () => {
    const calls = stubNetwork();
    const res = await POST(
      request({
        email: "buyer@example.com",
        slot_at: new Date(Date.now() - 60_000).toISOString(),
        timezone: "UTC",
        bump: false,
      }),
    );
    expect(res.status).toBe(422);
    expect(calls).toHaveLength(0);
  });

  it("rejects junk bodies with 422", async () => {
    stubNetwork();
    const res = await POST(request({ email: "not-an-email", slot_at: "x", timezone: "UTC" }));
    expect(res.status).toBe(422);
  });
});
