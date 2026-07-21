// fitscore.test.ts — the 0-100 ICP scorer (SPEC §4.2). Pure math, no network.

import { describe, it, expect } from "vitest";
import { scoreFit, icpFromSearch, fitBand } from "../fitscore";
import type { EnrichmentSignals } from "../types";

const icp = icpFromSearch({
  title: "VP of Marketing",
  industry: "SaaS",
  companySize: "51-200",
  seniority: "VP",
  keywords: "RevOps",
});

describe("scoreFit", () => {
  it("scores a full structured match high, and momentum pushes it toward 100", () => {
    const strong: EnrichmentSignals = {
      title: "VP of Marketing",
      industry: "SaaS software",
      companySize: "51-200",
      seniority: "VP",
      recentJobMove: true,
      recentPostActivity: true,
      mutualConnections: 10,
    };
    const score = scoreFit(strong, icp);
    expect(score).toBeGreaterThanOrEqual(90);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("scores a pure-signal match (no momentum) at or below the 80 core ceiling", () => {
    const noMomentum: EnrichmentSignals = {
      title: "VP of Marketing",
      industry: "SaaS",
      companySize: "51-200",
      seniority: "VP",
    };
    const score = scoreFit(noMomentum, icp);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(80);
  });

  it("scores an unrelated candidate near zero", () => {
    const off: EnrichmentSignals = {
      title: "Line Cook",
      industry: "Restaurants",
      companySize: "1-10",
      seniority: "Entry",
    };
    expect(scoreFit(off, icp)).toBeLessThan(20);
  });

  it("is deterministic — same inputs, same score", () => {
    const s: EnrichmentSignals = { title: "VP of Marketing", industry: "SaaS" };
    expect(scoreFit(s, icp)).toBe(scoreFit(s, icp));
  });

  it("gives momentum-only bonuses when the ICP has no structured target (free-text search)", () => {
    const freeIcp = icpFromSearch({ freeText: "head of sales at b2b software" });
    const match: EnrichmentSignals = { title: "Head of Sales", industry: "B2B Software", recentJobMove: true };
    const noMatch: EnrichmentSignals = { title: "Dentist", industry: "Healthcare" };
    expect(scoreFit(match, freeIcp)).toBeGreaterThan(scoreFit(noMatch, freeIcp));
  });

  it("clamps to the 0..100 range and rounds to an integer", () => {
    const s: EnrichmentSignals = {
      title: "VP of Marketing",
      industry: "SaaS",
      companySize: "51-200",
      seniority: "VP",
      mutualConnections: 9999,
      recentJobMove: true,
      recentPostActivity: true,
    };
    const score = scoreFit(s, icp);
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("mutual-connection bonus saturates (5+ mutuals == same bonus)", () => {
    const base: EnrichmentSignals = { title: "VP of Marketing", industry: "SaaS" };
    const five = scoreFit({ ...base, mutualConnections: 5 }, icp);
    const fifty = scoreFit({ ...base, mutualConnections: 50 }, icp);
    expect(five).toBe(fifty);
  });
});

describe("fitBand", () => {
  it("labels the score bands", () => {
    expect(fitBand(85)).toBe("strong");
    expect(fitBand(55)).toBe("worth-a-look");
    expect(fitBand(10)).toBe("weak");
  });
});
