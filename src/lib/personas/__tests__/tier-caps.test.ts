import { describe, it, expect } from "vitest";
import {
  TIER_LIMITS,
  evaluateCanCreatePersona,
  evaluateCanInviteSeat,
  evaluateCanSendMessage,
  tierFromSubscription,
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

describe("monthKey", () => {
  it("formats yyyy-mm in UTC", () => {
    expect(monthKey(new Date("2026-06-05T12:00:00Z"))).toBe("2026-06");
    expect(monthKey(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01");
    expect(monthKey(new Date("2026-12-01T00:00:00Z"))).toBe("2026-12");
  });
});
