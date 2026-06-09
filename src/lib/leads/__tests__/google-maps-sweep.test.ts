import { describe, it, expect } from "vitest";
import { isRealWebsite } from "../brightdata";
import { mapsSweepCap, emptyMapsFilters } from "../types";

describe("isRealWebsite (the no-website headline, PA-LS-9)", () => {
  it("treats a real business domain as a website", () => {
    expect(isRealWebsite("https://summit-exteriors.com")).toBe(true);
    expect(isRealWebsite("ridgelineroofing.com")).toBe(true);
    expect(isRealWebsite("https://www.example-hvac.net/contact")).toBe(true);
  });

  it("treats a Facebook / Instagram page as NOT a website", () => {
    expect(isRealWebsite("https://facebook.com/SummitExteriors")).toBe(false);
    expect(isRealWebsite("https://www.facebook.com/biz/123")).toBe(false);
    expect(isRealWebsite("https://business.facebook.com/x")).toBe(false);
    expect(isRealWebsite("https://instagram.com/summit_exteriors")).toBe(false);
    expect(isRealWebsite("https://linktr.ee/summit")).toBe(false);
  });

  it("treats an empty / malformed value as no website", () => {
    expect(isRealWebsite("")).toBe(false);
    expect(isRealWebsite("   ")).toBe(false);
    expect(isRealWebsite("not a url")).toBe(false);
  });
});

describe("mapsSweepCap (tier volume caps, PA-LS-6)", () => {
  it("maps each tier to the SPEC ceiling", () => {
    expect(mapsSweepCap("starter")).toBe(25);
    expect(mapsSweepCap("pro")).toBe(250);
    expect(mapsSweepCap("pro_plus")).toBe(250);
    expect(mapsSweepCap("studio")).toBe(2500);
    expect(mapsSweepCap("studio_plus")).toBe(10000);
    expect(mapsSweepCap("enterprise")).toBe(10000);
  });

  it("defaults an unknown tier to the free ceiling", () => {
    expect(mapsSweepCap("mystery")).toBe(25);
  });
});

describe("emptyMapsFilters", () => {
  it("defaults the no-website filter ON (the headline) and the rest off", () => {
    const f = emptyMapsFilters();
    expect(f.noWebsite).toBe(true);
    expect(f.hasPhone).toBe(false);
    expect(f.hasEmail).toBe(false);
    expect(f.minReviews).toBeNull();
    expect(f.maxReviews).toBeNull();
  });
});
