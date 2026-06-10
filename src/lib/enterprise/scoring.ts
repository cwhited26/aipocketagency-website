// Enterprise qualification scoring (Part 8G) — pure, deterministic, computed server-side at insert.
//
// High-fit signals score +3, medium +2, low -3. The total maps to a recommended route:
//   20+  → Enterprise sales call
//   12–19 → AI Agent Workspace + Premium Done-With-You Setup
//   6–11  → Business Agent + Standard Done-With-You Setup
//   0–5   → 14-Day Pilot / Business Agent self-serve
//   <0    → educational content / webinar replay
//
// Some Part 8G signals have no clean form field (e.g. "wants AI to run business without review",
// "only wants free advice") — those are diagnosed on the sales call, not scored here. Only signals
// the form can determine are applied, and each is commented with its Part 8G origin.

import type { EnterpriseApplicationInput, QualificationRoute } from "./types";

const HIGH_REVENUE = new Set([
  "$100K–$250K/month",
  "$250K–$500K/month",
  "$500K+/month",
]);
const TEAM_6_PLUS = new Set(["6–10", "11–25", "26–50", "51+"]);
const READY_30_DAYS = new Set(["Immediately", "Within 2 weeks", "Within 30 days"]);

function has(value: string): boolean {
  return value.trim().length > 0;
}

function usingAi(tools: string[]): boolean {
  return tools.some((t) => t !== "None") && tools.length > 0;
}

/** Compute the qualification score for an application. Returns the raw score (can be negative). */
export function scoreApplication(app: EnterpriseApplicationInput): number {
  let score = 0;

  // ── High fit (+3 each) ────────────────────────────────────────────────────
  if (HIGH_REVENUE.has(app.monthlyRevenueRange)) score += 3; // $100K+/month revenue
  if (TEAM_6_PLUS.has(app.teamSize)) score += 3; // Team of 6 or more
  if (app.highVolumeUsage.startsWith("Yes")) score += 3; // Needs custom usage
  if (app.needsPermissions === "Yes") score += 3; // Needs permissions
  if (app.needsByoLlm === "Yes") score += 3; // Needs BYO LLM
  if (app.needsIntegrations === "Yes") score += 3; // Needs integrations
  if (has(app.biggestBottleneck)) score += 3; // Has clear workflow bottleneck
  if (usingAi(app.currentAiTools) && has(app.currentAiPain)) score += 3; // Using AI + hitting friction
  if (app.usedPocketAgentBefore !== "" && app.usedPocketAgentBefore !== "No") score += 3; // Already using PA
  if (
    app.interestedApps.includes("Lead Scout") ||
    app.interestedApps.includes("Idea Engine")
  ) {
    score += 3; // Wants Lead Scout or Idea Engine at volume
  }
  if (app.implementationOwner !== "" && app.implementationOwner !== "Not sure") score += 3; // Has impl owner
  if (READY_30_DAYS.has(app.timeline)) score += 3; // Ready within 30 days

  // ── Medium fit (+2 each) ──────────────────────────────────────────────────
  if (app.monthlyRevenueRange === "$50K–$100K/month") score += 2; // $50K–$100K/month
  if (app.teamSize === "2–5") score += 2; // Team of 2–5
  if (app.desiredWorkflows.length > 0) score += 2; // Knows first workflow
  if (app.willingToGatherContext === "Yes") score += 2; // Willing to gather context
  if (
    has(app.budgetRange) &&
    app.budgetRange !== "Under $1,000/month" &&
    app.budgetRange !== "Not sure"
  ) {
    score += 2; // Budget above $1,000/month
  }
  if (app.dwyInterest === "Yes, Premium Done-With-You Setup") score += 2; // Interested in Premium DWY

  // ── Low fit (-3 each) ─────────────────────────────────────────────────────
  if (!has(app.biggestBottleneck) && app.desiredWorkflows.length === 0) score -= 3; // No clear workflow
  if (app.implementationOwner === "" || app.implementationOwner === "Not sure") score -= 3; // No impl owner
  if (app.timeline === "Just researching") score -= 3; // Just researching
  if (app.monthlyRevenueRange === "Under $10K/month") score -= 3; // Under $10K/month
  if (!has(app.budgetRange)) score -= 3; // No budget given
  if (app.willingToGatherContext === "No") score -= 3; // Refuses to add context
  if (app.usedPocketAgentBefore === "No" && !usingAi(app.currentAiTools)) score -= 3; // Hasn't tried any setup

  return score;
}

/** Map a score to a recommended route (Part 8G routing matrix). */
export function routeForScore(score: number): QualificationRoute {
  if (score < 0) return "educational";
  if (score >= 20) return "enterprise";
  if (score >= 12) return "workspace_premium_dwy";
  if (score >= 6) return "business_standard_dwy";
  return "pilot";
}

export function isQualificationRoute(value: string | undefined): value is QualificationRoute {
  return (
    value === "enterprise" ||
    value === "workspace_premium_dwy" ||
    value === "business_standard_dwy" ||
    value === "pilot" ||
    value === "educational"
  );
}
