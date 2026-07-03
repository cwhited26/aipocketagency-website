// Project Pass decision logic (PA-POS-31) — pure functions, no I/O, unit-tested directly.
// The I/O wrapper that resolves tier + passes from the database is lib/metering/entitlement.ts.
//
// The customer-autonomy amendment (2026-07-03) is enforced here in code: passPurchaseDecision
// never blocks, never discounts, never throttles — no matter the purchase count. The only thing
// a repeat rental triggers is the conversion nudge (shouldShowConversionNudge), which educates
// with the tier math and changes nothing about what the owner can buy or run.

import {
  getPassDef,
  passPriceCents,
  type PassAppSlug,
  type ProjectPassDef,
} from "@/data/project-passes";
import {
  tierAllowsAgentBuilder,
  tierAllowsBrowserAgent,
  tierAllowsDecisionRoundtable,
  tierAllowsIdeaEngineAutoBuild,
  tierAllowsLandingPageBuilder,
  type Tier,
} from "@/lib/personas/tier-caps";

export type ProjectPass = {
  id: string;
  appSlug: PassAppSlug;
  grantedAt: string;
  expiresAt: string;
  remainingRunBudget: number | null;
  pricePaidCents: number;
  tierAtPurchase: string;
};

export type EntitlementSource = "tier" | "project_pass";

export type AppEntitlement = {
  allowed: boolean;
  source: EntitlementSource | null;
  pass: ProjectPass | null;
};

/**
 * Does the tier itself include this App (no pass needed)? For idea_engine the bar is the
 * auto-build gate — the pass sells "one MVP ship," which is the Studio+ capability; Pro+
 * prompt-pack access rides the existing tier gate untouched.
 */
export function tierIncludesApp(tier: Tier, appSlug: PassAppSlug): boolean {
  switch (appSlug) {
    case "landing_page_builder":
      return tierAllowsLandingPageBuilder(tier);
    case "browser_agent":
      return tierAllowsBrowserAgent(tier);
    case "idea_engine":
      return tierAllowsIdeaEngineAutoBuild(tier);
    case "roundtable":
      return tierAllowsDecisionRoundtable(tier);
    case "agent_builder":
      return tierAllowsAgentBuilder(tier);
  }
}

/** Active = window still open AND (time-based, or run budget left). */
export function isPassActive(pass: ProjectPass, now: Date): boolean {
  if (new Date(pass.expiresAt).getTime() <= now.getTime()) return false;
  if (pass.remainingRunBudget !== null && pass.remainingRunBudget <= 0) return false;
  return true;
}

/** The newest active pass for this App, or null. */
export function activePassForApp(
  passes: readonly ProjectPass[],
  appSlug: PassAppSlug,
  now: Date,
): ProjectPass | null {
  const live = passes
    .filter((p) => p.appSlug === appSlug && isPassActive(p, now))
    .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
  return live[0] ?? null;
}

/**
 * The gate every App surface routes through: tier OR active Project Pass (PA-POS-31).
 * Tier wins when both hold — a Studio+ owner's usage is tier-included, never "rented."
 */
export function resolveAppEntitlement(
  tier: Tier,
  appSlug: PassAppSlug,
  passes: readonly ProjectPass[],
  now: Date,
): AppEntitlement {
  if (tierIncludesApp(tier, appSlug)) return { allowed: true, source: "tier", pass: null };
  const pass = activePassForApp(passes, appSlug, now);
  if (pass) return { allowed: true, source: "project_pass", pass };
  return { allowed: false, source: null, pass: null };
}

// ── Purchase (customer autonomy — the amendment, in code) ─────────────────────────────────

export type PassPurchaseDecision = {
  /** Always true for a valid catalog App — a repeat rental is never blocked. */
  allowed: true;
  /** The catalog price for this tier. Purchase history NEVER moves this number. */
  priceCents: number;
  def: ProjectPassDef;
};

/**
 * Price + permission for a pass purchase. `recentSameAppPassCount` is accepted and deliberately
 * ignored for both fields: the 3rd, 5th, or 50th rental of the same App costs the same and goes
 * through the same door as the 1st. The count only feeds the nudge (shouldShowConversionNudge).
 * Returns null only for an App that isn't in the catalog at all.
 */
export function passPurchaseDecision(
  appSlug: PassAppSlug,
  tier: Tier,
  recentSameAppPassCount: number,
): PassPurchaseDecision | null {
  void recentSameAppPassCount; // autonomy rule: history never prices, never gates
  const def = getPassDef(appSlug);
  if (!def) return null;
  return { allowed: true, priceCents: passPriceCents(def, tier), def };
}

// ── Conversion nudge (education, never pressure) ──────────────────────────────────────────

export const NUDGE_WINDOW_DAYS = 21;

/**
 * Show the tier-math nudge card when the owner has bought 2+ passes for the SAME App within a
 * 21-day window (the amendment's trigger: "after the 2nd purchase"). The nudge renders a card;
 * it never gates a run, never gates a purchase.
 */
export function shouldShowConversionNudge(
  passes: readonly Pick<ProjectPass, "appSlug" | "grantedAt">[],
  appSlug: PassAppSlug,
  now: Date,
): boolean {
  const windowStart = now.getTime() - NUDGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = passes.filter(
    (p) => p.appSlug === appSlug && new Date(p.grantedAt).getTime() >= windowStart,
  );
  return recent.length >= 2;
}

/** Days left on a time-based pass, for the "Project Pass active" chip. Rounds up; never below 0. */
export function passDaysLeft(pass: ProjectPass, now: Date): number {
  const ms = new Date(pass.expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
