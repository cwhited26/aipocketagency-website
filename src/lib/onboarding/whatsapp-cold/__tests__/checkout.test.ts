import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  WHATSAPP_TRIAL_CHECKOUT_SOURCE,
  buildTrialCheckoutToken,
  buildTrialCheckoutUrl,
  buildWhatsappTrialCheckoutParams,
  verifyTrialCheckoutToken,
} from "../checkout";

const ORIGINAL_KEY = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
const ORIGINAL_PRICE = process.env.STRIPE_POCKET_AGENT_PRICE_ID;
beforeAll(() => {
  process.env.GMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  process.env.STRIPE_POCKET_AGENT_PRICE_ID = "price_test_starter";
});
afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  else process.env.GMAIL_TOKEN_ENCRYPTION_KEY = ORIGINAL_KEY;
  if (ORIGINAL_PRICE === undefined) delete process.env.STRIPE_POCKET_AGENT_PRICE_ID;
  else process.env.STRIPE_POCKET_AGENT_PRICE_ID = ORIGINAL_PRICE;
});

const THREAD_ID = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-07-03T12:00:00.000Z");

describe("trial checkout link (§22.1 step 7)", () => {
  it("round-trips a signed token", () => {
    const token = buildTrialCheckoutToken(THREAD_ID, NOW);
    expect(verifyTrialCheckoutToken(token, NOW)).toEqual({ ok: true, threadId: THREAD_ID });
  });

  it("rejects a tampered token", () => {
    const token = buildTrialCheckoutToken(THREAD_ID, NOW);
    expect(verifyTrialCheckoutToken(token.slice(0, -2) + "xx", NOW)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("expires links past the trial TTL", () => {
    const token = buildTrialCheckoutToken(THREAD_ID, NOW);
    const later = new Date(NOW.getTime() + 15 * 24 * 60 * 60 * 1000);
    expect(verifyTrialCheckoutToken(token, later)).toEqual({ ok: false, reason: "expired" });
  });

  it("builds a URL onto the redirect route, carrying no phone number", () => {
    const url = buildTrialCheckoutUrl(THREAD_ID);
    expect(url).toContain("https://aipocketagent.com/api/whatsapp-trial/checkout?t=");
    expect(url).not.toContain("1555");
  });

  it("stamps the session with trial_thread_id and its own source (never pocket_agent)", () => {
    const built = buildWhatsappTrialCheckoutParams(THREAD_ID);
    if (!built.ok) throw new Error(built.error);
    const p = built.params;
    expect(p.get("metadata[source]")).toBe(WHATSAPP_TRIAL_CHECKOUT_SOURCE);
    expect(p.get("metadata[trial_thread_id]")).toBe(THREAD_ID);
    expect(p.get("subscription_data[metadata][trial_thread_id]")).toBe(THREAD_ID);
    expect(p.get("mode")).toBe("subscription");
    expect(p.get("line_items[0][price]")).toBe("price_test_starter");
    // Cold senders gave a phone, not an email — Stripe collects it at checkout.
    expect(p.get("customer_email")).toBeNull();
    expect(WHATSAPP_TRIAL_CHECKOUT_SOURCE).not.toBe("pocket_agent");
  });
});
