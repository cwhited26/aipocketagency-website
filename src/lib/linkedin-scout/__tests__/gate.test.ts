// gate.test.ts — the tier rate-limit ladder (SPEC §6). Pure decision, no DB.

import { describe, it, expect } from "vitest";
import {
  evaluateCanShortlist,
  weeklyShortlistCap,
  tierAllowsLinkedinScout,
  tierCanSeeLinkedinScout,
} from "../gate";

describe("weeklyShortlistCap ladder", () => {
  it("gates by tier per SPEC §6", () => {
    expect(weeklyShortlistCap("starter")).toBe(0);
    expect(weeklyShortlistCap("pro")).toBe(0);
    expect(weeklyShortlistCap("pro_plus")).toBe(20);
    expect(weeklyShortlistCap("studio")).toBe(100);
    expect(weeklyShortlistCap("studio_plus")).toBe(250);
    expect(weeklyShortlistCap("enterprise")).toBeNull();
  });
});

describe("tier visibility + entitlement", () => {
  it("Pro+ and up can run it; Business Agent and up can see it", () => {
    expect(tierAllowsLinkedinScout("pro")).toBe(false);
    expect(tierAllowsLinkedinScout("pro_plus")).toBe(true);
    expect(tierCanSeeLinkedinScout("starter")).toBe(false);
    expect(tierCanSeeLinkedinScout("pro")).toBe(true);
  });
});

describe("evaluateCanShortlist", () => {
  it("blocks tiers that can't run it at all", () => {
    const d = evaluateCanShortlist("pro", 0, 1);
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/Pro\+/);
  });

  it("allows under the cap", () => {
    expect(evaluateCanShortlist("pro_plus", 5, 10).ok).toBe(true);
    expect(evaluateCanShortlist("pro_plus", 19, 1).ok).toBe(true);
  });

  it("blocks when the batch would pass the cap", () => {
    const d = evaluateCanShortlist("pro_plus", 15, 10); // 15 + 10 > 20
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/5 left/);
  });

  it("blocks with a reset message when already at the cap", () => {
    const d = evaluateCanShortlist("studio", 100, 1);
    expect(d.ok).toBe(false);
    expect(d.reason).toMatch(/all 100/);
  });

  it("never caps Enterprise", () => {
    expect(evaluateCanShortlist("enterprise", 100_000, 500).ok).toBe(true);
  });
});
