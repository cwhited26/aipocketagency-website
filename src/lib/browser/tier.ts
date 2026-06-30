// tier.ts — monthly browser-action caps per tier (prompt item 9). Pure decision split from the DB
// read so the cap math is unit-tested in isolation. Keyed on the same Tier enum the rest of the
// orchestrator uses so the two ladders can never drift on tier names.
//
// Caps (prompt item 9):
//   Personal Brain  ($37,  `starter`) — 50 / month
//   Business Agent  ($97,  `pro`)     — 200 / month
//   AI Agent Workspace+ (`pro_plus` and above) — unlimited
//
// Note this is a usage cap, NOT a feature lock: Basic mode (hidden browser) is available to every
// tier — even Starter gets 50 runs a month — matching the SPEC's "same risk profile as a web fetch".
// The cap is the upsell wedge: a Business Agent owner who burns 200 actions feels the ceiling.

import { tierRank, type Tier } from "@/lib/personas/tier-caps";

// null = unlimited.
export const BROWSER_ACTION_CAPS: Record<Tier, number | null> = {
  starter: 50,
  pro: 200,
  pro_plus: null,
  studio: null,
  studio_plus: null,
  enterprise: null,
};

export function browserActionCap(tier: Tier): number | null {
  return BROWSER_ACTION_CAPS[tier];
}

export type CapDecision =
  | { ok: true; cap: number | null; remaining: number | null }
  | { ok: false; cap: number; remaining: 0; reason: string };

/**
 * Pure: does an owner on `tier` who has already used `usedThisMonth` actions have room for one more?
 * Unlimited tiers always pass. The reason copy drives the upgrade CTA on a block.
 */
export function evaluateBrowserActionCap(tier: Tier, usedThisMonth: number): CapDecision {
  const cap = BROWSER_ACTION_CAPS[tier];
  if (cap === null) return { ok: true, cap: null, remaining: null };
  if (usedThisMonth >= cap) {
    const upsell =
      tierRank(tier) < tierRank("pro_plus")
        ? " Upgrade for more browser actions, or wait for next month's reset."
        : " They reset next month.";
    return {
      ok: false,
      cap,
      remaining: 0,
      reason: `You've used all ${cap} browser actions on your plan this month.${upsell}`,
    };
  }
  return { ok: true, cap, remaining: cap - usedThisMonth };
}
