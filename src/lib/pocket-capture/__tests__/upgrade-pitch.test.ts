import { describe, expect, it } from "vitest";
import {
  daysSince,
  dismissUntilIso,
  isDismissalActive,
  meetsUpgradeThreshold,
  shouldShowUpgradePitch,
  UPGRADE_DISMISS_DAYS,
} from "../upgrade-pitch";

const NOW = Date.parse("2026-06-23T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("daysSince", () => {
  it("computes elapsed days", () => {
    expect(daysSince(daysAgo(14), NOW)).toBeCloseTo(14, 5);
  });
  it("returns null for an unparseable timestamp", () => {
    expect(daysSince("not-a-date", NOW)).toBeNull();
  });
});

describe("meetsUpgradeThreshold — 30 captures OR 14 days", () => {
  it("true at 30 captures even when freshly signed up", () => {
    expect(meetsUpgradeThreshold({ captureCount: 30, signupAt: daysAgo(0), nowMs: NOW })).toBe(true);
  });
  it("false at 29 captures and 13 days", () => {
    expect(meetsUpgradeThreshold({ captureCount: 29, signupAt: daysAgo(13), nowMs: NOW })).toBe(
      false,
    );
  });
  it("true at 14 days even with few captures", () => {
    expect(meetsUpgradeThreshold({ captureCount: 3, signupAt: daysAgo(14), nowMs: NOW })).toBe(true);
  });
  it("falls back to capture count when signup date is unparseable", () => {
    expect(meetsUpgradeThreshold({ captureCount: 30, signupAt: "bad", nowMs: NOW })).toBe(true);
    expect(meetsUpgradeThreshold({ captureCount: 5, signupAt: "bad", nowMs: NOW })).toBe(false);
  });
});

describe("shouldShowUpgradePitch — full gate (PC-MARK-5)", () => {
  const base = {
    isPocketCaptureUser: true,
    hasActivePaSubscription: false,
    captureCount: 30,
    signupAt: daysAgo(1),
    nowMs: NOW,
  };

  it("shows for a standalone buyer at 30 captures", () => {
    expect(shouldShowUpgradePitch(base)).toBe(true);
  });

  it("hides for a paid PA subscriber even past the threshold", () => {
    expect(shouldShowUpgradePitch({ ...base, hasActivePaSubscription: true })).toBe(false);
  });

  it("hides for a standalone buyer at 5 captures + 3 days (below threshold)", () => {
    expect(
      shouldShowUpgradePitch({ ...base, captureCount: 5, signupAt: daysAgo(3) }),
    ).toBe(false);
  });

  it("hides for a non-buyer", () => {
    expect(shouldShowUpgradePitch({ ...base, isPocketCaptureUser: false })).toBe(false);
  });
});

describe("7-day dismissal", () => {
  it("dismissUntilIso is exactly UPGRADE_DISMISS_DAYS in the future", () => {
    const iso = dismissUntilIso(NOW);
    expect(Date.parse(iso)).toBe(NOW + UPGRADE_DISMISS_DAYS * 86_400_000);
  });

  it("is active within the window and expired after it", () => {
    const iso = dismissUntilIso(NOW);
    expect(isDismissalActive(iso, NOW + 6 * 86_400_000)).toBe(true);
    expect(isDismissalActive(iso, NOW + 8 * 86_400_000)).toBe(false);
  });

  it("is inactive for null or unparseable values", () => {
    expect(isDismissalActive(null, NOW)).toBe(false);
    expect(isDismissalActive("garbage", NOW)).toBe(false);
  });
});
