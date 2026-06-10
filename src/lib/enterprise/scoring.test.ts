import { describe, it, expect } from "vitest";
import { scoreApplication, routeForScore, isQualificationRoute } from "./scoring";
import type { EnterpriseApplicationInput } from "./types";

function base(overrides: Partial<EnterpriseApplicationInput> = {}): EnterpriseApplicationInput {
  return {
    firstName: "",
    lastName: "",
    email: "a@b.com",
    phone: "",
    company: "Acme",
    website: "",
    role: "Founder / Owner",
    businessType: "",
    whatYouSell: "things",
    whoYouSellTo: "",
    monthlyRevenueRange: "",
    teamSize: "",
    currentAiTools: [],
    currentAiPain: "",
    contextLocations: [],
    desiredWorkflows: [],
    biggestBottleneck: "",
    successOutcome: "",
    interestedApps: [],
    highVolumeUsage: "",
    needsPermissions: "",
    needsByoLlm: "",
    needsIntegrations: "",
    integrationSystems: "",
    timeline: "",
    implementationOwner: "",
    willingToGatherContext: "",
    usedPocketAgentBefore: "",
    budgetRange: "",
    dwyInterest: "",
    additionalNotes: "",
    ...overrides,
  };
}

describe("routeForScore (Part 8G matrix)", () => {
  it("maps score bands to the recommended routes", () => {
    expect(routeForScore(25)).toBe("enterprise");
    expect(routeForScore(20)).toBe("enterprise");
    expect(routeForScore(19)).toBe("workspace_premium_dwy");
    expect(routeForScore(12)).toBe("workspace_premium_dwy");
    expect(routeForScore(11)).toBe("business_standard_dwy");
    expect(routeForScore(6)).toBe("business_standard_dwy");
    expect(routeForScore(5)).toBe("pilot");
    expect(routeForScore(0)).toBe("pilot");
    expect(routeForScore(-1)).toBe("educational");
  });
});

describe("scoreApplication", () => {
  it("a strong, high-volume, ready team scores into the Enterprise band", () => {
    const app = base({
      monthlyRevenueRange: "$250K–$500K/month", // +3
      teamSize: "11–25", // +3
      highVolumeUsage: "Yes, high lead research volume", // +3
      needsPermissions: "Yes", // +3
      needsByoLlm: "Yes", // +3
      needsIntegrations: "Yes", // +3
      biggestBottleneck: "leads slip through follow-up", // +3 (and not low)
      currentAiTools: ["ChatGPT", "Claude"], // friction combo +3
      currentAiPain: "starts from a blank box every time",
      usedPocketAgentBefore: "Yes, AI Agent Workspace", // +3
      interestedApps: ["Lead Scout", "Idea Engine"], // +3
      implementationOwner: "Me", // +3
      timeline: "Within 30 days", // +3
      willingToGatherContext: "Yes", // medium +2
      budgetRange: "$5,000–$10,000/month", // medium +2
      desiredWorkflows: ["Lead research"], // medium +2
    });
    const score = scoreApplication(app);
    expect(score).toBeGreaterThanOrEqual(20);
    expect(routeForScore(score)).toBe("enterprise");
  });

  it("a mid-market applicant lands in the workspace + premium DWY band", () => {
    const app = base({
      monthlyRevenueRange: "$50K–$100K/month", // +2
      teamSize: "2–5", // +2
      biggestBottleneck: "content is inconsistent", // +3
      currentAiTools: ["ChatGPT"], // +3 with pain
      currentAiPain: "re-explaining the business constantly",
      implementationOwner: "Operations lead", // +3
      desiredWorkflows: ["Content creation"], // +2
      willingToGatherContext: "Yes", // +2
      timeline: "Within 60 days", // not within-30, no high-fit
    });
    const score = scoreApplication(app);
    expect(score).toBeGreaterThanOrEqual(12);
    expect(score).toBeLessThan(20);
    expect(routeForScore(score)).toBe("workspace_premium_dwy");
  });

  it("an unqualified researcher with no fit goes negative → educational", () => {
    const app = base({
      monthlyRevenueRange: "Under $10K/month", // -3
      timeline: "Just researching", // -3
      willingToGatherContext: "No", // -3
      usedPocketAgentBefore: "No", // hasn't tried + no AI tools → -3
      // no bottleneck + no workflows → -3 ; no impl owner → -3 ; no budget → -3
    });
    const score = scoreApplication(app);
    expect(score).toBeLessThan(0);
    expect(routeForScore(score)).toBe("educational");
  });
});

describe("isQualificationRoute", () => {
  it("accepts known routes and rejects junk", () => {
    expect(isQualificationRoute("enterprise")).toBe(true);
    expect(isQualificationRoute("pilot")).toBe(true);
    expect(isQualificationRoute("nope")).toBe(false);
    expect(isQualificationRoute(undefined)).toBe(false);
  });
});
