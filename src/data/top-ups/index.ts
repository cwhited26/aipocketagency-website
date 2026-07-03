// Top Up bundles catalog (PA-POS-30). Studio+ / Enterprise ONLY — the entry tiers (Personal
// Brain $37, Business Agent $97) never see credits or Top Ups; that hard rule is enforced in
// lib/metering/credits.ts (tierGetsCredits), not here. This file is just the shelf.
//
// Sizing: 1 credit = 2,500 micro-cents of raw model/provider spend (CREDIT_MICRO_CENTS in
// lib/metering/credits.ts), so each bundle carries an 8-10× margin over API rates — matching the
// SPEC §20 "pure-margin rates, 5-10× the raw model spend" structure. $50 → 2,000 credits covers
// $5.00 of raw spend (one fully-capped Browser Agent job); $150 → 7,000; $500 → 25,000. Chase
// tunes these after the first purchases — change the numbers here, nothing else moves.

export type TopUpBundleId = "top_up_50" | "top_up_150" | "top_up_500";

export type TopUpBundle = {
  id: TopUpBundleId;
  /** Stripe line-item name — what the buyer sees on the checkout page and receipt. */
  name: string;
  amountCents: number;
  credits: number;
};

export const TOP_UP_BUNDLES: readonly TopUpBundle[] = [
  { id: "top_up_50", name: "Pocket Agent Top Up — 2,000 credits", amountCents: 5_000, credits: 2_000 },
  { id: "top_up_150", name: "Pocket Agent Top Up — 7,000 credits", amountCents: 15_000, credits: 7_000 },
  { id: "top_up_500", name: "Pocket Agent Top Up — 25,000 credits", amountCents: 50_000, credits: 25_000 },
] as const;

export function getTopUpBundle(id: string): TopUpBundle | null {
  return TOP_UP_BUNDLES.find((b) => b.id === id) ?? null;
}

export function isTopUpBundleId(id: string): id is TopUpBundleId {
  return TOP_UP_BUNDLES.some((b) => b.id === id);
}
