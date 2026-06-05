import { describe, it, expect } from "vitest";
import {
  evaluateRateLimit,
  getApiTierLimits,
  apiTierFromSubscription,
  isApiTier,
} from "./rate-limit";

describe("rate-limit tiers", () => {
  it("free tier has the spec daily cap and a default hourly burst", () => {
    const limits = getApiTierLimits("free");
    expect(limits.perDay).toBe(1000);
    expect(limits.perHour).toBe(100);
  });

  it("enterprise is unlimited", () => {
    const limits = getApiTierLimits("enterprise");
    expect(limits.perDay).toBeNull();
    expect(limits.perHour).toBeNull();
  });

  it("maps subscription to free by default and honors a valid override", () => {
    expect(apiTierFromSubscription("active", null)).toBe("free");
    expect(apiTierFromSubscription(null, "publish")).toBe("publish");
    expect(apiTierFromSubscription(null, "bogus")).toBe("free");
  });

  it("isApiTier guards the union", () => {
    expect(isApiTier("sync")).toBe(true);
    expect(isApiTier("gold")).toBe(false);
  });
});

describe("evaluateRateLimit", () => {
  const limits = { perHour: 100, perDay: 1000 };

  it("allows under both windows and reports binding remaining", () => {
    const d = evaluateRateLimit({ hourCount: 10, dayCount: 900, limits });
    expect(d.allowed).toBe(true);
    // day headroom (100) is smaller than hour headroom (90)? hour: 100-10=90, day: 1000-900=100 → 90
    expect(d.remaining).toBe(90);
  });

  it("blocks on the hour window first (shorter retry)", () => {
    const d = evaluateRateLimit({ hourCount: 100, dayCount: 100, limits });
    expect(d.allowed).toBe(false);
    expect(d.window).toBe("hour");
    expect(d.retryAfterSec).toBe(3600);
  });

  it("blocks on the day window when only the day cap is hit", () => {
    const d = evaluateRateLimit({ hourCount: 5, dayCount: 1000, limits });
    expect(d.allowed).toBe(false);
    expect(d.window).toBe("day");
    expect(d.retryAfterSec).toBe(86_400);
  });

  it("treats null limits as unlimited", () => {
    const d = evaluateRateLimit({
      hourCount: 9_999_999,
      dayCount: 9_999_999,
      limits: { perHour: null, perDay: null },
    });
    expect(d.allowed).toBe(true);
  });
});
