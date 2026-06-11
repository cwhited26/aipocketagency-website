import { describe, it, expect } from "vitest";
import {
  SHORT_FORM_ADS,
  RETARGETING_ADS,
  STATIC_HEADLINES,
  STATIC_PRIMARY_TEXT,
  NICHE_CAMPAIGNS,
  getAdsByCategory,
  getAdsByNiche,
} from "./index";

// Drift guard. The same ad data is mirrored as platform-agnostic JSON in the
// brain at marketing/ads/ (short-form.json / retargeting.json / etc.). The brain
// repo isn't checked out when this test runs, so we pin the canonical record
// counts here instead of reading across repos: if someone adds or removes an ad
// in this manifest without bumping the matching count, the test fails loudly —
// the reminder to update the brain JSON in lockstep. Keep these numbers equal to
// the array lengths in the brain JSON files.
const CANONICAL = {
  shortForm: 30, // brain/marketing/ads/short-form.json
  retargeting: 10, // brain/marketing/ads/retargeting.json
  staticHeadlines: 20, // brain/marketing/ads/static-headlines.json
  staticPrimaryText: 10, // brain/marketing/ads/static-primary-text.json
  niches: 10, // brain/marketing/ads/niche-campaigns/*.json
} as const;

describe("ad library record counts (brain-JSON drift guard)", () => {
  it("matches the canonical short-form ad count", () => {
    expect(SHORT_FORM_ADS.length).toBe(CANONICAL.shortForm);
  });
  it("matches the canonical retargeting ad count", () => {
    expect(RETARGETING_ADS.length).toBe(CANONICAL.retargeting);
  });
  it("matches the canonical static-headline count", () => {
    expect(STATIC_HEADLINES.length).toBe(CANONICAL.staticHeadlines);
  });
  it("matches the canonical static-primary-text count", () => {
    expect(STATIC_PRIMARY_TEXT.length).toBe(CANONICAL.staticPrimaryText);
  });
  it("matches the canonical niche-campaign count", () => {
    expect(NICHE_CAMPAIGNS.length).toBe(CANONICAL.niches);
  });
});

describe("ad library integrity", () => {
  it("has unique short-form ad ids", () => {
    const ids = SHORT_FORM_ADS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("has unique retargeting ad ids", () => {
    const ids = RETARGETING_ADS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("has unique niche ids matching the Lead Scout vertical slugs", () => {
    const ids = NICHE_CAMPAIGNS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "coaches-and-consultants",
      "agencies",
      "service-businesses",
      "roofing",
      "hvac",
      "painting",
      "general-contracting",
      "med-spa",
      "law-firm",
      "dentist",
    ]);
  });
});

describe("ad library helpers", () => {
  it("getAdsByCategory returns every ad in a category", () => {
    const leadScout = getAdsByCategory("lead-scout");
    expect(leadScout.length).toBeGreaterThan(0);
    expect(leadScout.every((a) => a.category === "lead-scout")).toBe(true);
  });
  it("getAdsByNiche resolves a known niche and rejects an unknown one", () => {
    expect(getAdsByNiche("roofing")?.niche).toBe("Roofing");
    expect(getAdsByNiche("not-a-niche")).toBeUndefined();
  });
});
