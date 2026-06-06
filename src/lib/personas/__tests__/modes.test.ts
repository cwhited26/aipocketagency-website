import { describe, it, expect } from "vitest";
import {
  ADDONS,
  badgeRemovableForTier,
  evaluateCanUseMode,
  TIER_MODES,
} from "../tier-caps";

describe("TIER_MODES (SPEC v3 §10)", () => {
  it("starter has no modes; pro is internal-only", () => {
    expect(TIER_MODES.starter).toEqual([]);
    expect(TIER_MODES.pro).toEqual(["internal_team"]);
  });
  it("studio unlocks all three modes", () => {
    expect(TIER_MODES.studio).toContain("public_link");
    expect(TIER_MODES.studio).toContain("widget");
  });
});

describe("evaluateCanUseMode", () => {
  it("pro cannot use public/widget without an add-on", () => {
    expect(evaluateCanUseMode("pro", "public_link").ok).toBe(false);
    expect(evaluateCanUseMode("pro", "widget").ok).toBe(false);
  });
  it("an add-on unlocks the matching mode for pro", () => {
    expect(evaluateCanUseMode("pro", "public_link", ["public_persona"]).ok).toBe(true);
    expect(evaluateCanUseMode("pro", "widget", ["widget_persona"]).ok).toBe(true);
  });
  it("studio can use every mode", () => {
    expect(evaluateCanUseMode("studio", "internal_team").ok).toBe(true);
    expect(evaluateCanUseMode("studio", "public_link").ok).toBe(true);
    expect(evaluateCanUseMode("studio", "widget").ok).toBe(true);
  });
  it("every tier can always use internal_team except starter", () => {
    expect(evaluateCanUseMode("pro", "internal_team").ok).toBe(true);
    expect(evaluateCanUseMode("starter", "internal_team").ok).toBe(false);
  });
});

describe("badgeRemovableForTier (white-label)", () => {
  it("is only true for studio and above", () => {
    expect(badgeRemovableForTier("pro")).toBe(false);
    expect(badgeRemovableForTier("pro_plus")).toBe(false);
    expect(badgeRemovableForTier("studio")).toBe(true);
    expect(badgeRemovableForTier("studio_plus")).toBe(true);
    expect(badgeRemovableForTier("enterprise")).toBe(true);
  });
});

describe("ADDONS pricing (SPEC v3 §10)", () => {
  it("public +$19, widget +$29", () => {
    expect(ADDONS.public_persona.priceMonthly).toBe(19);
    expect(ADDONS.widget_persona.priceMonthly).toBe(29);
  });
});
