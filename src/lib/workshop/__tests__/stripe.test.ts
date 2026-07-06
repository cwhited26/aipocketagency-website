// The OTO charge path + webhook signature (PA-POS-38 §24.3). Fetch is stubbed; the assertions
// pin the exact REST calls: the saved payment method resolves from the subscription, and the
// PaymentIntent posts off_session+confirm against it.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  chargeWorkshopOto,
  resolveSavedPaymentMethod,
  verifyWorkshopStripeSignature,
} from "../stripe";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function stubStripe(handlers: Record<string, (init?: RequestInit) => { status: number; body: unknown }>) {
  const calls: Array<{ url: string; body: string | null }> = [];
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: typeof init?.body === "string" ? init.body : null });
      for (const [needle, handler] of Object.entries(handlers)) {
        if (url.includes(needle)) {
          const r = handler(init);
          return new Response(JSON.stringify(r.body), { status: r.status });
        }
      }
      return new Response(JSON.stringify({ error: "unmatched" }), { status: 404 });
    }),
  );
  return calls;
}

describe("resolveSavedPaymentMethod", () => {
  it("prefers the subscription's default_payment_method", async () => {
    stubStripe({
      "subscriptions/sub_1": () => ({ status: 200, body: { default_payment_method: "pm_sub" } }),
    });
    const r = await resolveSavedPaymentMethod({ customerId: "cus_1", subscriptionId: "sub_1" });
    expect(r).toEqual({ ok: true, data: "pm_sub" });
  });

  it("falls back to the customer's first card", async () => {
    stubStripe({
      "subscriptions/sub_1": () => ({ status: 200, body: { default_payment_method: null } }),
      "customers/cus_1/payment_methods": () => ({ status: 200, body: { data: [{ id: "pm_card" }] } }),
    });
    const r = await resolveSavedPaymentMethod({ customerId: "cus_1", subscriptionId: "sub_1" });
    expect(r).toEqual({ ok: true, data: "pm_card" });
  });
});

describe("chargeWorkshopOto", () => {
  it("posts an off-session confirmed PaymentIntent on the saved payment method", async () => {
    const calls = stubStripe({
      payment_intents: () => ({ status: 200, body: { id: "pi_1", status: "succeeded", last_payment_error: null } }),
    });
    const r = await chargeWorkshopOto({
      oto: 1,
      customerId: "cus_1",
      paymentMethodId: "pm_sub",
      registrationId: "reg-1",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe("succeeded");
    const body = calls.find((c) => c.url.includes("payment_intents"))!.body!;
    const params = new URLSearchParams(body);
    expect(params.get("amount")).toBe("99700");
    expect(params.get("customer")).toBe("cus_1");
    expect(params.get("payment_method")).toBe("pm_sub");
    expect(params.get("off_session")).toBe("true");
    expect(params.get("confirm")).toBe("true");
  });

  it("surfaces a decline as a non-ok result", async () => {
    stubStripe({
      payment_intents: () => ({ status: 402, body: { error: { code: "card_declined" } } }),
    });
    const r = await chargeWorkshopOto({
      oto: 2,
      customerId: "cus_1",
      paymentMethodId: "pm_sub",
      registrationId: "reg-1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(402);
  });
});

describe("verifyWorkshopStripeSignature", () => {
  it("accepts a valid v1 signature and rejects tampering", () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ id: "evt_1" });
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", secret).update(`${ts}.${body}`, "utf8").digest("hex");
    const header = `t=${ts},v1=${sig}`;
    expect(verifyWorkshopStripeSignature(body, header, secret)).toEqual({ ok: true });
    expect(verifyWorkshopStripeSignature(body + "x", header, secret).ok).toBe(false);
    expect(verifyWorkshopStripeSignature(body, null, secret).ok).toBe(false);
  });

  it("rejects a stale timestamp", () => {
    const secret = "whsec_test";
    const body = "{}";
    const ts = Math.floor(Date.now() / 1000) - 3600;
    const sig = createHmac("sha256", secret).update(`${ts}.${body}`, "utf8").digest("hex");
    expect(verifyWorkshopStripeSignature(body, `t=${ts},v1=${sig}`, secret).ok).toBe(false);
  });
});
