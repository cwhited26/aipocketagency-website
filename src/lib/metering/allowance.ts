// Credit allowance resolution (PA-POS-30). getCreditStatus is what the App pages call; it
// returns null for every tier below studio_plus — that null is the Personal Brain / Business
// Agent hard rule (no allowance row is ever created for them, no query even runs).
//
// Consumption is recomputed from the pa_cost_events ledger on every read (the ledger is the
// source of truth); the consumed_credits column is a display cache refreshed opportunistically.

import { getCurrentTier, type Tier } from "@/lib/personas/tier-caps";
import {
  buildCreditStatus,
  microCentsToCredits,
  TIER_MONTHLY_CREDIT_ALLOWANCE,
  tierGetsCredits,
  type CreditStatus,
} from "./credits";
import {
  fetchLatestAllowance,
  insertAllowance,
  sumMeteredCostMicroCents,
  sumTopUpCredits,
  updateAllowanceConsumed,
  type AllowanceRow,
} from "./store";

const CYCLE_DAYS = 30;

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * The current-cycle allowance row, created on first read for a credit-tier owner and rolled
 * forward when the cycle has lapsed (the reset cron does the bulk roll; this is the on-demand
 * path so a chip render never shows a stale cycle).
 */
async function getOrRollAllowance(ownerId: string, tier: "studio_plus" | "enterprise"): Promise<AllowanceRow | null> {
  const nowIso = new Date().toISOString();
  const latest = await fetchLatestAllowance(ownerId);
  if (latest && latest.cycle_end > nowIso) return latest;
  return rollAllowanceForward(ownerId, tier, latest, nowIso);
}

/**
 * Open the next cycle. Unused Top Up credits from the lapsed cycle carry forward into the new
 * allowance (an owner who paid for credits keeps them); the tier's monthly grant does not.
 */
export async function rollAllowanceForward(
  ownerId: string,
  tier: "studio_plus" | "enterprise",
  lapsed: AllowanceRow | null,
  nowIso: string,
): Promise<AllowanceRow | null> {
  let carriedTopUpCredits = 0;
  if (lapsed) {
    const [consumedMicroCents, topUpCredits] = await Promise.all([
      sumMeteredCostMicroCents(ownerId, lapsed.cycle_start),
      sumTopUpCredits(ownerId, lapsed.cycle_start, lapsed.cycle_end),
    ]);
    const consumed = microCentsToCredits(consumedMicroCents);
    const unused = Math.max(0, lapsed.allowance_credits + topUpCredits - consumed);
    carriedTopUpCredits = Math.min(unused, topUpCredits);
  }
  // A fresh cycle starts where the old one ended (no gap in the ledger window); first-ever
  // cycles start now. Skips forward past fully-idle months in one step rather than looping.
  const cycleStart = lapsed && lapsed.cycle_end > addDays(nowIso, -CYCLE_DAYS) ? lapsed.cycle_end : nowIso;
  return insertAllowance({
    ownerId,
    tierSlug: tier,
    cycleStart,
    cycleEnd: addDays(cycleStart, CYCLE_DAYS),
    allowanceCredits: TIER_MONTHLY_CREDIT_ALLOWANCE[tier] + carriedTopUpCredits,
  });
}

/**
 * The full credit picture for one owner, or null when the tier has no credit system (starter,
 * pro, pro_plus, studio — the entry tiers never see this). Pass `opts.tier` when already resolved.
 */
export async function getCreditStatus(
  ownerId: string,
  opts?: { tier?: Tier },
): Promise<CreditStatus | null> {
  const tier = opts?.tier ?? (await getCurrentTier(ownerId));
  if (!tierGetsCredits(tier)) return null;
  const creditTier = tier as "studio_plus" | "enterprise";

  const row = await getOrRollAllowance(ownerId, creditTier);
  if (!row) return null;

  const [consumedMicroCents, topUpCredits] = await Promise.all([
    sumMeteredCostMicroCents(ownerId, row.cycle_start),
    sumTopUpCredits(ownerId, row.cycle_start, row.cycle_end),
  ]);

  const status = buildCreditStatus({
    tier,
    cycleStart: row.cycle_start,
    cycleEnd: row.cycle_end,
    allowanceCredits: row.allowance_credits,
    topUpCredits,
    consumedMicroCents,
  });

  // Refresh the display cache when it drifted; fire-and-forget.
  if (status.consumedCredits !== row.consumed_credits) {
    void updateAllowanceConsumed(row.id, status.consumedCredits);
  }
  return status;
}
