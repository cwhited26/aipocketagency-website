import { describe, it, expect } from "vitest";
import {
  TIER_LIMITS,
  PRICE_TO_TIER,
  TIER_TO_PRICE,
  TIER_PRICE_USD_MONTHLY,
  ADDON_PRICE_IDS,
  evaluateCanCreatePersona,
  evaluateCanInviteSeat,
  evaluateCanSendMessage,
  getTierFromStripePriceId,
  getAddonFromStripePriceId,
  highestTierFromPriceIds,
  resolveCheckoutTier,
  resolveProvisionTier,
  tierFromSubscription,
  tierRank,
  monthKey,
} from "../tier-caps";

describe("TIER_LIMITS", () => {
  it("encodes the SPEC v3 §10 pricing table", () => {
    expect(TIER_LIMITS.starter.personas).toBe(0);
    expect(TIER_LIMITS.pro.personas).toBe(5);
    expect(TIER_LIMITS.pro.seatsPerPersona).toBe(10);
    expect(TIER_LIMITS.pro.messagesPerMonthPerPersona).toBe(2_000);
    expect(TIER_LIMITS.pro_plus.personas).toBe(10);
    expect(TIER_LIMITS.studio.messagesPerMonthPerPersona).toBe(15_000);
    expect(TIER_LIMITS.studio_plus.seatsPerPersona).toBeNull();
    expect(TIER_LIMITS.enterprise.personas).toBeNull();
  });
});

describe("evaluateCanCreatePersona", () => {
  it("blocks the starter tier entirely", () => {
    expect(evaluateCanCreatePersona("starter", 0).ok).toBe(false);
  });
  it("allows pro under the cap and blocks at the cap", () => {
    expect(evaluateCanCreatePersona("pro", 4).ok).toBe(true);
    expect(evaluateCanCreatePersona("pro", 5).ok).toBe(false);
    expect(evaluateCanCreatePersona("pro", 6).ok).toBe(false);
  });
  it("never blocks unlimited tiers", () => {
    expect(evaluateCanCreatePersona("enterprise", 999).ok).toBe(true);
  });
});

describe("evaluateCanInviteSeat", () => {
  it("enforces the per-persona seat cap", () => {
    expect(evaluateCanInviteSeat("pro", 9).ok).toBe(true);
    expect(evaluateCanInviteSeat("pro", 10).ok).toBe(false);
  });
  it("allows unlimited seats on studio_plus", () => {
    expect(evaluateCanInviteSeat("studio_plus", 500).ok).toBe(true);
  });
  it("blocks seats on starter", () => {
    expect(evaluateCanInviteSeat("starter", 0).ok).toBe(false);
  });
});

describe("evaluateCanSendMessage", () => {
  it("allows under the monthly cap and blocks at/over it", () => {
    expect(evaluateCanSendMessage("pro", 1_999).ok).toBe(true);
    expect(evaluateCanSendMessage("pro", 2_000).ok).toBe(false);
    expect(evaluateCanSendMessage("pro", 2_500).ok).toBe(false);
  });
  it("never blocks unlimited tiers", () => {
    expect(evaluateCanSendMessage("enterprise", 10_000_000).ok).toBe(true);
  });
  it("returns an upgrade-flavored reason when capped", () => {
    const d = evaluateCanSendMessage("pro", 2_000);
    expect(d.ok).toBe(false);
    expect(d.reason.toLowerCase()).toContain("month");
  });
});

describe("tierFromSubscription", () => {
  it("maps no subscription to starter", () => {
    expect(tierFromSubscription(null, null)).toBe("starter");
    expect(tierFromSubscription("canceled", null)).toBe("starter");
  });
  it("maps an active/trialing subscription to pro by default", () => {
    expect(tierFromSubscription("active", null)).toBe("pro");
    expect(tierFromSubscription("trialing", null)).toBe("pro");
    expect(tierFromSubscription("trial", null)).toBe("pro");
  });
  it("honors a valid env override for active subscribers", () => {
    expect(tierFromSubscription("active", "studio")).toBe("studio");
  });
  it("ignores an invalid env override", () => {
    expect(tierFromSubscription("active", "not-a-tier")).toBe("pro");
  });
  it("never lets an env override promote a non-subscriber", () => {
    expect(tierFromSubscription(null, "enterprise")).toBe("starter");
  });
});

describe("getTierFromStripePriceId (PA-ORCH-10 SMB ladder)", () => {
  it("maps every SMB ladder price ID to its tier", () => {
    expect(getTierFromStripePriceId("price_1TdyfmJ6S5nx9HK5EeAZQEPj")).toBe("starter");
    expect(getTierFromStripePriceId("price_1TfRbIJ6S5nx9HK5sucoD8sB")).toBe("pro");
    expect(getTierFromStripePriceId("price_1TfRbJJ6S5nx9HK5ldFrZv5o")).toBe("pro_plus");
    expect(getTierFromStripePriceId("price_1TfRbKJ6S5nx9HK5g3U1yYOK")).toBe("studio");
    expect(getTierFromStripePriceId("price_1TfRbLJ6S5nx9HK54VQ2nc0m")).toBe("studio_plus");
  });
  it("defaults unknown price IDs to starter", () => {
    expect(getTierFromStripePriceId("price_does_not_exist")).toBe("starter");
    expect(getTierFromStripePriceId("")).toBe("starter");
  });
  it("does not map the dev add-on prices to an SMB tier via the table", () => {
    expect(PRICE_TO_TIER[ADDON_PRICE_IDS.sync]).toBeUndefined();
    expect(PRICE_TO_TIER[ADDON_PRICE_IDS.publish]).toBeUndefined();
  });
  it("PRICE_TO_TIER has exactly the five Stripe-backed SMB tiers (no enterprise)", () => {
    expect(Object.keys(PRICE_TO_TIER)).toHaveLength(5);
    expect(Object.values(PRICE_TO_TIER)).not.toContain("enterprise");
  });
});

describe("getAddonFromStripePriceId (SPEC v4 Wave 3 dev add-ons)", () => {
  it("maps the add-on price IDs to their product", () => {
    expect(getAddonFromStripePriceId("price_1TfRmxJ6S5nx9HK5SoqFHdOY")).toBe("sync");
    expect(getAddonFromStripePriceId("price_1TfRmyJ6S5nx9HK5R9uxFpgd")).toBe("publish");
  });
  it("returns null for SMB ladder prices and unknown prices", () => {
    expect(getAddonFromStripePriceId("price_1TfRbIJ6S5nx9HK5sucoD8sB")).toBeNull();
    expect(getAddonFromStripePriceId("price_nope")).toBeNull();
  });
});

describe("highestTierFromPriceIds", () => {
  it("returns null when no price is an SMB ladder price", () => {
    expect(highestTierFromPriceIds([])).toBeNull();
    expect(highestTierFromPriceIds([ADDON_PRICE_IDS.sync, "price_x"])).toBeNull();
  });
  it("picks the highest SMB tier when several are present", () => {
    expect(
      highestTierFromPriceIds([
        "price_1TfRbIJ6S5nx9HK5sucoD8sB", // pro
        "price_1TfRbKJ6S5nx9HK5g3U1yYOK", // studio
        "price_1TdyfmJ6S5nx9HK5EeAZQEPj", // starter
      ]),
    ).toBe("studio");
  });
  it("ignores add-on prices mixed in and returns the SMB tier", () => {
    expect(
      highestTierFromPriceIds([ADDON_PRICE_IDS.sync, "price_1TfRbIJ6S5nx9HK5sucoD8sB"]),
    ).toBe("pro");
  });
});

describe("TIER_TO_PRICE (checkout-side reverse mapping)", () => {
  it("is the exact inverse of PRICE_TO_TIER", () => {
    for (const [priceId, tier] of Object.entries(PRICE_TO_TIER)) {
      expect(TIER_TO_PRICE[tier as keyof typeof TIER_TO_PRICE]).toBe(priceId);
    }
  });
  it("covers every paid tier (5 tiers, no enterprise)", () => {
    expect(Object.keys(TIER_TO_PRICE).sort()).toEqual(
      ["pro", "pro_plus", "starter", "studio", "studio_plus"].sort(),
    );
    expect(TIER_TO_PRICE).not.toHaveProperty("enterprise");
  });
  it("routes each paid tier to its live Stripe price ID", () => {
    expect(TIER_TO_PRICE.starter).toBe("price_1TdyfmJ6S5nx9HK5EeAZQEPj");
    expect(TIER_TO_PRICE.pro).toBe("price_1TfRbIJ6S5nx9HK5sucoD8sB");
    expect(TIER_TO_PRICE.pro_plus).toBe("price_1TfRbJJ6S5nx9HK5ldFrZv5o");
    expect(TIER_TO_PRICE.studio).toBe("price_1TfRbKJ6S5nx9HK5g3U1yYOK");
    expect(TIER_TO_PRICE.studio_plus).toBe("price_1TfRbLJ6S5nx9HK54VQ2nc0m");
  });
});

describe("TIER_PRICE_USD_MONTHLY", () => {
  it("encodes the PA-ORCH-10 SMB ladder figures", () => {
    expect(TIER_PRICE_USD_MONTHLY.starter).toBe(37);
    expect(TIER_PRICE_USD_MONTHLY.pro).toBe(97);
    expect(TIER_PRICE_USD_MONTHLY.pro_plus).toBe(149);
    expect(TIER_PRICE_USD_MONTHLY.studio).toBe(297);
    expect(TIER_PRICE_USD_MONTHLY.studio_plus).toBe(497);
  });
});

describe("resolveCheckoutTier (?tier= param validation)", () => {
  it("accepts every paid tier verbatim", () => {
    expect(resolveCheckoutTier("starter")).toBe("starter");
    expect(resolveCheckoutTier("pro")).toBe("pro");
    expect(resolveCheckoutTier("pro_plus")).toBe("pro_plus");
    expect(resolveCheckoutTier("studio")).toBe("studio");
    expect(resolveCheckoutTier("studio_plus")).toBe("studio_plus");
  });
  it("falls back to starter on missing/unknown/empty params", () => {
    expect(resolveCheckoutTier(null)).toBe("starter");
    expect(resolveCheckoutTier(undefined)).toBe("starter");
    expect(resolveCheckoutTier("")).toBe("starter");
    expect(resolveCheckoutTier("free")).toBe("starter");
    expect(resolveCheckoutTier("PRO")).toBe("starter"); // case-sensitive
  });
  it("treats enterprise (no Stripe price) as not-checkout-able → starter", () => {
    expect(resolveCheckoutTier("enterprise")).toBe("starter");
  });
});

describe("resolveProvisionTier (webhook tier resolution)", () => {
  it("derives the tier from the active price ID (source of truth)", () => {
    expect(
      resolveProvisionTier({ priceIds: ["price_1TfRbIJ6S5nx9HK5sucoD8sB"] }),
    ).toBe("pro");
  });
  it("picks the highest tier when prices are stacked", () => {
    expect(
      resolveProvisionTier({
        priceIds: [
          "price_1TfRbIJ6S5nx9HK5sucoD8sB", // pro
          "price_1TfRbKJ6S5nx9HK5g3U1yYOK", // studio
        ],
      }),
    ).toBe("studio");
  });
  it("falls back to a valid metadata.tier when the price isn't mapped", () => {
    expect(
      resolveProvisionTier({ priceIds: ["price_unmapped"], metadataTier: "studio_plus" }),
    ).toBe("studio_plus");
  });
  it("prefers the price-derived tier over metadata when both are present", () => {
    expect(
      resolveProvisionTier({
        priceIds: ["price_1TfRbKJ6S5nx9HK5g3U1yYOK"], // studio
        metadataTier: "pro",
      }),
    ).toBe("studio");
  });
  it("returns null for add-on-only subscriptions with no SMB price or metadata", () => {
    expect(resolveProvisionTier({ priceIds: [ADDON_PRICE_IDS.sync] })).toBeNull();
    expect(resolveProvisionTier({ priceIds: [] })).toBeNull();
  });
  it("ignores an invalid or enterprise metadata.tier", () => {
    expect(
      resolveProvisionTier({ priceIds: ["price_unmapped"], metadataTier: "bogus" }),
    ).toBeNull();
    expect(
      resolveProvisionTier({ priceIds: ["price_unmapped"], metadataTier: "enterprise" }),
    ).toBeNull();
  });
});

describe("tierRank", () => {
  it("orders the ladder starter < pro < … < enterprise", () => {
    expect(tierRank("starter")).toBeLessThan(tierRank("pro"));
    expect(tierRank("pro")).toBeLessThan(tierRank("pro_plus"));
    expect(tierRank("studio_plus")).toBeLessThan(tierRank("enterprise"));
  });
});

describe("monthKey", () => {
  it("formats yyyy-mm in UTC", () => {
    expect(monthKey(new Date("2026-06-05T12:00:00Z"))).toBe("2026-06");
    expect(monthKey(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01");
    expect(monthKey(new Date("2026-12-01T00:00:00Z"))).toBe("2026-12");
  });
});
