import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildPocketAgentCheckoutParams,
  priceIdForCheckout,
} from "../pocket-agent-checkout";
import { TIER_TO_PRICE, type PaidTier } from "../personas/tier-caps";

describe("priceIdForCheckout (/start?tier= price routing)", () => {
  const savedEnv = process.env.STRIPE_POCKET_AGENT_PRICE_ID;
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.STRIPE_POCKET_AGENT_PRICE_ID;
    else process.env.STRIPE_POCKET_AGENT_PRICE_ID = savedEnv;
  });

  it("routes every paid tier to its live Stripe price (env unset)", () => {
    delete process.env.STRIPE_POCKET_AGENT_PRICE_ID;
    const tiers: PaidTier[] = ["starter", "pro", "pro_plus", "studio", "studio_plus"];
    for (const tier of tiers) {
      expect(priceIdForCheckout(tier)).toBe(TIER_TO_PRICE[tier]);
    }
  });

  it("starter prefers STRIPE_POCKET_AGENT_PRICE_ID when set (back-compat)", () => {
    process.env.STRIPE_POCKET_AGENT_PRICE_ID = "price_env_override";
    expect(priceIdForCheckout("starter")).toBe("price_env_override");
    // The env override is starter-only; paid tiers still use the live mapping.
    expect(priceIdForCheckout("pro")).toBe(TIER_TO_PRICE.pro);
  });
});

describe("buildPocketAgentCheckoutParams", () => {
  const base = {
    email: "owner@example.com",
    name: "Chase",
    origin: "https://aipocketagent.com",
    userId: "user-123",
  };

  it("stamps source + tier metadata into both session and subscription for each tier", () => {
    const tiers: PaidTier[] = ["starter", "pro", "pro_plus", "studio", "studio_plus"];
    for (const tier of tiers) {
      const p = buildPocketAgentCheckoutParams({
        ...base,
        tier,
        priceId: TIER_TO_PRICE[tier],
      });
      expect(p.get("mode")).toBe("subscription");
      expect(p.get("line_items[0][price]")).toBe(TIER_TO_PRICE[tier]);
      expect(p.get("subscription_data[trial_period_days]")).toBe("14");
      // source + tier on BOTH the session and the subscription so the webhook provisions.
      expect(p.get("metadata[source]")).toBe("pocket_agent");
      expect(p.get("metadata[tier]")).toBe(tier);
      expect(p.get("subscription_data[metadata][source]")).toBe("pocket_agent");
      expect(p.get("subscription_data[metadata][tier]")).toBe(tier);
    }
  });

  it("threads user_id into client_reference_id + metadata when signed in", () => {
    const p = buildPocketAgentCheckoutParams({
      ...base,
      tier: "pro",
      priceId: TIER_TO_PRICE.pro,
    });
    expect(p.get("client_reference_id")).toBe("user-123");
    expect(p.get("subscription_data[metadata][user_id]")).toBe("user-123");
  });

  it("omits user_id fields for anonymous checkout", () => {
    const p = buildPocketAgentCheckoutParams({
      ...base,
      userId: null,
      tier: "studio",
      priceId: TIER_TO_PRICE.studio,
    });
    expect(p.get("client_reference_id")).toBeNull();
    expect(p.get("subscription_data[metadata][user_id]")).toBeNull();
  });

  it("regression: the Starter trial flow is unchanged (starter price + tier=starter + 14d trial)", () => {
    const p = buildPocketAgentCheckoutParams({
      ...base,
      tier: "starter",
      priceId: TIER_TO_PRICE.starter,
    });
    expect(p.get("line_items[0][price]")).toBe("price_1TdyfmJ6S5nx9HK5EeAZQEPj");
    expect(p.get("metadata[tier]")).toBe("starter");
    expect(p.get("subscription_data[metadata][source]")).toBe("pocket_agent");
    expect(p.get("subscription_data[trial_period_days]")).toBe("14");
  });

  it("routes success to /upsell carrying the session id (funnel post-checkout OTO)", () => {
    const p = buildPocketAgentCheckoutParams({
      ...base,
      tier: "pro",
      priceId: TIER_TO_PRICE.pro,
    });
    expect(p.get("success_url")).toBe(
      "https://aipocketagent.com/upsell?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(p.get("cancel_url")).toBe("https://aipocketagent.com/pricing");
  });

  it("omits the order-form bump line items by default", () => {
    const p = buildPocketAgentCheckoutParams({
      ...base,
      tier: "pro",
      priceId: TIER_TO_PRICE.pro,
    });
    expect(
      p.get("subscription_data[add_invoice_items][0][price_data][unit_amount]"),
    ).toBeNull();
    expect(p.get("metadata[bump_fast_start_brain_import]")).toBeNull();
  });

  it("adds the Fast-Start Brain Import as a one-time first-invoice line when bump is set", () => {
    const p = buildPocketAgentCheckoutParams({
      ...base,
      tier: "pro",
      priceId: TIER_TO_PRICE.pro,
      bump: true,
    });
    expect(
      p.get("subscription_data[add_invoice_items][0][price_data][currency]"),
    ).toBe("usd");
    expect(
      p.get("subscription_data[add_invoice_items][0][price_data][unit_amount]"),
    ).toBe("4900");
    expect(
      p.get("subscription_data[add_invoice_items][0][price_data][product_data][name]"),
    ).toBe("Fast-Start Brain Import");
    expect(p.get("metadata[bump_fast_start_brain_import]")).toBe("true");
  });
});
