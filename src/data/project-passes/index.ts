// Project Pass catalog (PA-POS-31, SPEC §21 sample pricing table). A pass rents one tier-gated
// App to a lower-tier owner for a bounded window: 7 days for time-based Apps, one run for
// build-based Apps. Prices are tiered — a Business Agent ($97) renter pays less than a Personal
// Brain ($37) renter for the same App, because they're already paying more toward the platform.
//
// Hard rules that live in code, not just copy (PA-POS-31 amendment, 2026-07-03):
//   - A pass purchase is NEVER blocked, throttled, or auto-discounted, no matter how many the
//     owner has bought (lib/metering/passes.ts passPurchaseDecision).
//   - Per-run cost caps still hold — a $30 Browser Agent pass unlocks the App; the $5/run cap
//     enforces separately (browserAgentJobLimits).
//
// Draft prices per SPEC §21 — tune after the first 20 purchases.

import type { Tier } from "@/lib/personas/tier-caps";

/** The rentable Apps. `agent_builder` ships from the Custom Agent Builder lane (PA-POS-27) —
 *  it's in the catalog so the pass works the day that App lands; until then nothing links here. */
export type PassAppSlug =
  | "landing_page_builder"
  | "browser_agent"
  | "idea_engine"
  | "roundtable"
  | "agent_builder"
  | "ghl_connector";

export type ProjectPassDef = {
  appSlug: PassAppSlug;
  /** Customer-facing App name. */
  label: string;
  /** Stripe line-item name. */
  checkoutName: string;
  /** Where the App lives, for post-purchase redirect. */
  appHref: string;
  /** 'time' = expires_at bounded (7 days); 'run' = remaining_run_budget bounded (one run). */
  kind: "time" | "run";
  windowDays: number;
  runBudget: number | null;
  /** What the window is, in the customer's words — "7 days", "one MVP ship", "one debate". */
  windowLabel: string;
  /** Personal Brain ($37) rental price. */
  personalBrainCents: number;
  /** Business Agent ($97) and above rental price. */
  businessAgentCents: number;
};

export const PROJECT_PASS_CATALOG: readonly ProjectPassDef[] = [
  {
    appSlug: "landing_page_builder",
    label: "Landing Page Builder",
    checkoutName: "Project Pass — Landing Page Builder, 7 days",
    appHref: "/app/apps/landing-pages",
    kind: "time",
    windowDays: 7,
    runBudget: null,
    windowLabel: "7 days",
    personalBrainCents: 2_000,
    businessAgentCents: 1_500,
  },
  {
    appSlug: "browser_agent",
    label: "Browser Agent",
    checkoutName: "Project Pass — Browser Agent, 7 days",
    appHref: "/app/apps/browser",
    kind: "time",
    windowDays: 7,
    runBudget: null,
    windowLabel: "7 days",
    personalBrainCents: 3_000,
    businessAgentCents: 2_200,
  },
  {
    appSlug: "idea_engine",
    label: "Idea Engine",
    checkoutName: "Project Pass — Idea Engine, one MVP ship",
    appHref: "/app/apps/idea-engine",
    kind: "run",
    // A run pass still carries a generous outer window so an abandoned pass doesn't linger forever.
    windowDays: 90,
    runBudget: 1,
    windowLabel: "one MVP ship",
    personalBrainCents: 5_000,
    businessAgentCents: 3_500,
  },
  {
    appSlug: "roundtable",
    label: "Decision Roundtable",
    checkoutName: "Project Pass — Decision Roundtable, one debate",
    appHref: "/app/decisions",
    kind: "run",
    windowDays: 90,
    runBudget: 1,
    windowLabel: "one debate",
    personalBrainCents: 1_000,
    businessAgentCents: 700,
  },
  {
    appSlug: "agent_builder",
    label: "Custom Agent Builder",
    checkoutName: "Project Pass — Custom Agent Builder, 7 days",
    appHref: "/app/apps/agent-builder",
    kind: "time",
    windowDays: 7,
    runBudget: null,
    windowLabel: "7 days",
    personalBrainCents: 3_000,
    businessAgentCents: 2_200,
  },
  // GHL Connector proof-of-concept pass (PA-GHL-6): $50 / 7 days, ONE client sub-account.
  // Priced flat across renter tiers — the pass exists for Business Agent ($97) to prove the
  // connector on one client before upgrading to Pro+/Studio+; the 1-client cap is enforced in
  // lib/ghl/entitlement.ts, not here.
  {
    appSlug: "ghl_connector",
    label: "GHL Connector",
    checkoutName: "Project Pass — GHL Connector, 7 days, 1 client",
    appHref: "/app/integrations/ghl",
    kind: "time",
    windowDays: 7,
    runBudget: null,
    windowLabel: "7 days",
    personalBrainCents: 5_000,
    businessAgentCents: 5_000,
  },
] as const;

export function getPassDef(appSlug: string): ProjectPassDef | null {
  return PROJECT_PASS_CATALOG.find((p) => p.appSlug === appSlug) ?? null;
}

export function isPassAppSlug(slug: string): slug is PassAppSlug {
  return PROJECT_PASS_CATALOG.some((p) => p.appSlug === slug);
}

/**
 * The rental price for this owner's tier. Personal Brain (starter) pays the full rental rate;
 * Business Agent (pro) and every tier above pays the discounted rate — they're already paying
 * more toward the platform (SPEC §21). The price NEVER varies by purchase history.
 */
export function passPriceCents(def: ProjectPassDef, tier: Tier): number {
  return tier === "starter" ? def.personalBrainCents : def.businessAgentCents;
}
