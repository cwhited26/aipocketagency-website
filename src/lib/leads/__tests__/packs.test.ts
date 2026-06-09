import { describe, it, expect } from "vitest";
import {
  LEAD_SCOUT_PACKS,
  getPack,
  voiceBriefFor,
  packToMapsConfig,
} from "../packs";
import { tierAllowsLeadScoutPacks } from "@/lib/personas/tier-caps";

const EXPECTED_SLUGS = [
  "roofing",
  "hvac",
  "painting",
  "general-contracting",
  "med-spa",
  "law-firm",
  "dentist",
];

describe("LEAD_SCOUT_PACKS", () => {
  it("ships exactly the seven Phase-4 verticals, in order", () => {
    expect(LEAD_SCOUT_PACKS.map((p) => p.vertical_slug)).toEqual(EXPECTED_SLUGS);
  });

  it("each pack carries the fields the surface + sweep need", () => {
    for (const p of LEAD_SCOUT_PACKS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.icon.length).toBeGreaterThan(0);
      expect(p.card_noun.length).toBeGreaterThan(0);
      expect(p.tagline.length).toBeGreaterThan(0);
      expect(p.display_description.length).toBeGreaterThan(0);
      expect(p.default_google_maps_category.length).toBeGreaterThan(0);
      expect(p.default_radius_miles).toBeGreaterThan(0);
      expect(p.outreach_voice_brief.length).toBeGreaterThan(0);
      expect(["cold-introduce", "warm-followup", "reactivate"]).toContain(p.default_outreach_tone);
      expect(["studio", "studio_plus"]).toContain(p.recommended_tier);
    }
  });

  it("defaults the no-website filter on for every pack (the headline cut)", () => {
    for (const p of LEAD_SCOUT_PACKS) {
      expect(p.default_filters.no_website).toBe(true);
    }
  });

  it("keeps no-slop copy out of the customer-facing strings", () => {
    const banned = /\b(leverage|unlock|empower|seamless|revolutionary|elevate|robust)\b/i;
    for (const p of LEAD_SCOUT_PACKS) {
      expect(p.tagline).not.toMatch(banned);
      expect(p.display_description).not.toMatch(banned);
    }
  });
});

describe("getPack", () => {
  it("finds a pack by slug", () => {
    expect(getPack("roofing")?.name).toBe("Roofing Contractors");
    expect(getPack("med-spa")?.recommended_tier).toBe("studio_plus");
  });

  it("returns null for an unknown slug", () => {
    expect(getPack("plumbing")).toBeNull();
  });
});

describe("voiceBriefFor", () => {
  it("returns the pack's brief for a known slug", () => {
    expect(voiceBriefFor("roofing")).toBe(getPack("roofing")?.outreach_voice_brief);
  });

  it("returns null for a hand-built source (null/undefined/unknown slug)", () => {
    expect(voiceBriefFor(null)).toBeNull();
    expect(voiceBriefFor(undefined)).toBeNull();
    expect(voiceBriefFor("plumbing")).toBeNull();
  });
});

describe("packToMapsConfig", () => {
  it("builds the sweep criteria from the pack + the owner's location", () => {
    const pack = getPack("roofing");
    expect(pack).not.toBeNull();
    if (!pack) return;
    const config = packToMapsConfig(pack, "Knoxville, TN");
    expect(config.category).toBe(pack.default_google_maps_category);
    expect(config.location).toBe("Knoxville, TN");
    expect(config.radiusMiles).toBe(pack.default_radius_miles);
    expect(config.filters.noWebsite).toBe(pack.default_filters.no_website);
    expect(config.filters.minReviews).toBe(pack.default_filters.min_reviews);
    expect(config.filters.hasPhone).toBe(pack.default_filters.has_phone);
  });
});

describe("tierAllowsLeadScoutPacks", () => {
  it("gates subscribe to Studio+ and Enterprise", () => {
    expect(tierAllowsLeadScoutPacks("studio_plus")).toBe(true);
    expect(tierAllowsLeadScoutPacks("enterprise")).toBe(true);
  });

  it("blocks everything below Studio+", () => {
    expect(tierAllowsLeadScoutPacks("starter")).toBe(false);
    expect(tierAllowsLeadScoutPacks("pro")).toBe(false);
    expect(tierAllowsLeadScoutPacks("pro_plus")).toBe(false);
    expect(tierAllowsLeadScoutPacks("studio")).toBe(false);
  });
});
