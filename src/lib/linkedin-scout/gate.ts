// gate.ts — tier rate-limit enforcement for LinkedIn Scout (SPEC §6).
//
// Every prospect the owner shortlists is one Approval-Queue candidate that can produce three sends,
// so the shortlist is the metered unit. The cap is a rolling 7-day count of shortlisted prospects,
// checked before a new prospect is queued. Pure decision (evaluateCanShortlist) split from the DB
// read (canShortlist) so the ladder unit-tests in isolation (gate.test.ts) — mirrors the
// tier-caps.ts / rituals gate pattern.
//
// Ladder (SPEC §6): Personal Brain / Business Agent can't run it (upgrade chip on the card); Pro+ 20,
// Studio 100, Studio+ 250, Enterprise uncapped. The in-between-tier mapping is monotonic — a higher
// price never grants fewer.

import { getCurrentTier, tierRank, type Tier, type CapDecision } from "@/lib/personas/tier-caps";
import { countShortlistedSince } from "./db";

/** Rolling-7-day shortlist cap per tier. null = uncapped; 0 = the tier can't run LinkedIn Scout at
 *  all (it sees the card with an upgrade chip). */
export const LINKEDIN_SCOUT_WEEKLY_CAPS: Record<Tier, number | null> = {
  starter: 0,
  pro: 0,
  pro_plus: 20,
  studio: 100,
  studio_plus: 250,
  enterprise: null,
};

/** The rolling window the cap counts over. */
export const ROLLING_WINDOW_DAYS = 7;

/** This tier's rolling-7d shortlist cap (null = uncapped, 0 = not entitled). */
export function weeklyShortlistCap(tier: Tier): number | null {
  return LINKEDIN_SCOUT_WEEKLY_CAPS[tier];
}

/** Can this tier run LinkedIn Scout at all? Pro+ and up (SPEC §6). Lower tiers see the upgrade card. */
export function tierAllowsLinkedinScout(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("pro_plus");
}

/** Should this tier even SEE the LinkedIn Scout card? Business Agent and up (SPEC §6) — Personal
 *  Brain gets an upgrade chip only when clicked. */
export function tierCanSeeLinkedinScout(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("pro");
}

/**
 * Pure: may this tier shortlist `count` more prospects, given how many it already has in the rolling
 * window? Returns a CapDecision so the route and the App surface show the same reason verbatim.
 */
export function evaluateCanShortlist(
  tier: Tier,
  shortlistedInWindow: number,
  count = 1,
): CapDecision {
  if (!tierAllowsLinkedinScout(tier)) {
    return {
      ok: false,
      reason:
        "LinkedIn Scout unlocks on Pro+. Upgrade to research LinkedIn prospects and stage the outreach for one-tap approval.",
    };
  }
  const cap = weeklyShortlistCap(tier);
  if (cap === null) return { ok: true, reason: "" };
  if (shortlistedInWindow + count > cap) {
    const remaining = Math.max(0, cap - shortlistedInWindow);
    return {
      ok: false,
      reason:
        remaining === 0
          ? `You've shortlisted all ${cap} prospects on your plan this week. It resets on a rolling 7-day window — or upgrade to raise the cap.`
          : `That would pass your weekly cap of ${cap} prospects — you have ${remaining} left this week. Trim the selection, or upgrade to raise the cap.`,
    };
  }
  return { ok: true, reason: "" };
}

/**
 * DB-backed gate: resolve the owner's tier, count how many prospects they've shortlisted in the
 * rolling window, and decide. Called before every prospect queue (the shortlist route).
 */
export async function canShortlist(ownerId: string, count = 1): Promise<CapDecision> {
  const tier = await getCurrentTier(ownerId);
  if (!tierAllowsLinkedinScout(tier)) return evaluateCanShortlist(tier, 0, count);
  const since = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const counted = await countShortlistedSince(ownerId, since);
  // A count read failure fails OPEN to the cap check with 0 — never blocks a paying owner on a
  // transient DB blip, and the unique index still stops a true duplicate from double-counting.
  const inWindow = counted.ok ? counted.data : 0;
  return evaluateCanShortlist(tier, inWindow, count);
}
