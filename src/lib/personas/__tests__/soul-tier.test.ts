import { describe, it, expect } from "vitest";
import {
  soulExtractionMode,
  soulActiveCap,
  tierAllowsSoulExtraction,
  tierAllowsCrossPersonaSoul,
  tierAllowsSoulExport,
  resolveSoulExtraction,
  evaluateCanAddSoulAttribute,
  TIERS,
} from "../tier-caps";
import {
  computeDecayedConfidence,
  isDecayedOut,
  SOUL_DECAY_GRACE_DAYS,
  routeByConfidence,
} from "../soul-types";

describe("soul tier gating (SPEC §Tier gating)", () => {
  it("Personal ($37, starter) is read-only — extraction off", () => {
    expect(soulExtractionMode("starter")).toBe("off");
    expect(tierAllowsSoulExtraction("starter")).toBe(false);
    expect(resolveSoulExtraction("starter", { personaHasSoul: true })).toEqual({
      allowed: false,
      reason: "read_only",
    });
  });

  it("Business ($97, pro) is opt-in per Persona with a 25 cap", () => {
    expect(soulExtractionMode("pro")).toBe("opt_in");
    expect(soulActiveCap("pro")).toBe(25);
    expect(resolveSoulExtraction("pro", { personaHasSoul: false })).toEqual({
      allowed: false,
      reason: "opt_in_pending",
    });
    expect(resolveSoulExtraction("pro", { personaHasSoul: true })).toEqual({ allowed: true });
  });

  it("Workspace ($497, studio_plus) is full + unlimited + export", () => {
    expect(soulExtractionMode("studio_plus")).toBe("full");
    expect(soulActiveCap("studio_plus")).toBeNull();
    expect(tierAllowsSoulExport("studio_plus")).toBe(true);
    expect(resolveSoulExtraction("studio_plus", { personaHasSoul: false })).toEqual({ allowed: true });
  });

  it("cross-Persona Soul sharing is Studio and up", () => {
    expect(tierAllowsCrossPersonaSoul("pro_plus")).toBe(false);
    expect(tierAllowsCrossPersonaSoul("studio")).toBe(true);
    expect(tierAllowsCrossPersonaSoul("enterprise")).toBe(true);
  });

  it("extraction mode is monotonic up the ladder (never less for more money)", () => {
    const rank = { off: 0, opt_in: 1, full: 2 } as const;
    let prev = -1;
    for (const t of TIERS) {
      const r = rank[soulExtractionMode(t)];
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });

  it("evaluateCanAddSoulAttribute enforces the per-Persona cap", () => {
    expect(evaluateCanAddSoulAttribute("pro", 24).ok).toBe(true);
    expect(evaluateCanAddSoulAttribute("pro", 25).ok).toBe(false);
    expect(evaluateCanAddSoulAttribute("studio_plus", 9999).ok).toBe(true); // unlimited
  });
});

describe("soul decay (SPEC §Decay)", () => {
  const base = new Date("2026-01-01T00:00:00Z").getTime();
  const daysLater = (d: number) => base + d * 86_400_000;

  it("does not decay within the 90-day grace window", () => {
    const c = computeDecayedConfidence({
      confidence: 0.7,
      lastReinforcedAt: "2026-01-01T00:00:00Z",
      now: daysLater(SOUL_DECAY_GRACE_DAYS),
      locked: false,
    });
    expect(c).toBeCloseTo(0.7, 5);
  });

  it("drops ~0.1 per month of dormancy beyond the grace window", () => {
    const c = computeDecayedConfidence({
      confidence: 0.7,
      lastReinforcedAt: "2026-01-01T00:00:00Z",
      now: daysLater(SOUL_DECAY_GRACE_DAYS + 30),
      locked: false,
    });
    expect(c).toBeCloseTo(0.6, 5);
  });

  it("locked attributes never decay", () => {
    const c = computeDecayedConfidence({
      confidence: 0.7,
      lastReinforcedAt: "2026-01-01T00:00:00Z",
      now: daysLater(400),
      locked: true,
    });
    expect(c).toBeCloseTo(0.7, 5);
  });

  it("isDecayedOut fires at/below the 0.3 floor", () => {
    expect(isDecayedOut(0.3)).toBe(true);
    expect(isDecayedOut(0.31)).toBe(false);
  });

  it("a fully-decayed attribute would route below the read floor", () => {
    const c = computeDecayedConfidence({
      confidence: 0.6,
      lastReinforcedAt: "2026-01-01T00:00:00Z",
      now: daysLater(SOUL_DECAY_GRACE_DAYS + 30 * 6),
      locked: false,
    });
    expect(isDecayedOut(c)).toBe(true);
    expect(routeByConfidence(c)).toBe("discard");
  });
});
