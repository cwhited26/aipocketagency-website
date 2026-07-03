// Credit allowance decision logic (PA-POS-30) — pure functions, no I/O, unit-tested directly.
// The I/O side (allowance rows, cost-event sums) is lib/metering/allowance.ts.
//
// THE HARD RULE, in code: credits exist for studio_plus (AI Agent Workspace $497) and enterprise
// ONLY. Personal Brain ($37 = starter) and Business Agent ($97 = pro) never see an allowance, a
// credit count, or a Top Up prompt — introducing credit anxiety at the entry tiers is Twin's trap
// and it kills conversion (SPEC §20). Every credits surface routes through tierGetsCredits /
// buildCreditsChipModel, so the rule holds everywhere at once.

import type { Tier } from "@/lib/personas/tier-caps";
import { TOP_UP_BUNDLES, type TopUpBundle } from "@/data/top-ups";

/** 1 credit = 2,500 micro-cents (0.25¢) of raw provider spend. A fully-capped $5 Browser Agent
 *  job is 2,000 credits; a typical Sonnet-routed task is single digits. */
export const CREDIT_MICRO_CENTS = 2_500;

/** Monthly allowance per tier. Zero = the tier has no credit system at all (not "0 credits" —
 *  the concept doesn't exist on their surfaces). Studio+ 20,000 credits ≈ $50 of raw spend —
 *  sized for typical use of Browser Agent + Idea Engine + Decision Roundtable. */
export const TIER_MONTHLY_CREDIT_ALLOWANCE: Record<Tier, number> = {
  starter: 0,
  pro: 0,
  pro_plus: 0,
  studio: 0,
  studio_plus: 20_000,
  enterprise: 100_000,
};

/** The App feature slugs that draw down the allowance — the expensive Apps (SPEC §20).
 *  agent_builder is listed defensively; its cost events start flowing when that lane lands. */
export const METERED_FEATURE_SLUGS = [
  "browser_agent",
  "idea_engine",
  "roundtable",
  "agent_builder",
] as const;

/** The one gate for every credits surface. studio_plus / enterprise only — see module header. */
export function tierGetsCredits(tier: Tier): boolean {
  return tier === "studio_plus" || tier === "enterprise";
}

/** Raw ledger micro-cents → credits consumed. Rounds up so consumption is never understated. */
export function microCentsToCredits(microCents: number): number {
  if (microCents <= 0) return 0;
  return Math.ceil(microCents / CREDIT_MICRO_CENTS);
}

export type CreditStatus = {
  tier: Tier;
  cycleStart: string;
  cycleEnd: string;
  /** The tier's monthly grant (plus any carried-over Top Up credits baked in at cycle reset). */
  allowanceCredits: number;
  /** Top Up credits bought inside this cycle. */
  topUpCredits: number;
  consumedCredits: number;
  remainingCredits: number;
};

/** Pure assembly of a CreditStatus from its parts (the I/O layer fetches the parts). */
export function buildCreditStatus(args: {
  tier: Tier;
  cycleStart: string;
  cycleEnd: string;
  allowanceCredits: number;
  topUpCredits: number;
  consumedMicroCents: number;
}): CreditStatus {
  const consumedCredits = microCentsToCredits(args.consumedMicroCents);
  const total = args.allowanceCredits + args.topUpCredits;
  return {
    tier: args.tier,
    cycleStart: args.cycleStart,
    cycleEnd: args.cycleEnd,
    allowanceCredits: args.allowanceCredits,
    topUpCredits: args.topUpCredits,
    consumedCredits,
    remainingCredits: Math.max(0, total - consumedCredits),
  };
}

/**
 * Offer the Top Up BEFORE the next action would exceed the allowance — never mid-session
 * (SPEC §20 "no mid-session surprises"). The threshold is one fully-capped Browser Agent job:
 * if the remaining balance can't absorb the most expensive single action on the shelf, the chip
 * surfaces the offer now. This is an offer, not a stop — an approved action always finishes.
 */
export const TOP_UP_OFFER_THRESHOLD_CREDITS = 2_000;

export function shouldOfferTopUp(status: Pick<CreditStatus, "remainingCredits">): boolean {
  return status.remainingCredits < TOP_UP_OFFER_THRESHOLD_CREDITS;
}

// ── The chip model — the single source for what any App page may render ────────────────────

export type CreditsChipModel = {
  remainingCredits: number;
  totalCredits: number;
  offerTopUp: boolean;
  bundles: readonly TopUpBundle[];
};

/**
 * Returns null unless the tier gets credits — this null IS the Personal Brain / Business Agent
 * hard rule. Pages render nothing when the model is null; there is no other code path to a chip.
 */
export function buildCreditsChipModel(tier: Tier, status: CreditStatus | null): CreditsChipModel | null {
  if (!tierGetsCredits(tier) || !status) return null;
  return {
    remainingCredits: status.remainingCredits,
    totalCredits: status.allowanceCredits + status.topUpCredits,
    offerTopUp: shouldOfferTopUp(status),
    bundles: TOP_UP_BUNDLES,
  };
}
