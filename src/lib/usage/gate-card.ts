// gate-card.ts — stage the Mission Control card the dispatcher raises when an owner hits 100% of a
// tier limit, instead of firing a new background run (Usage Surface v1, PA-USAGE-6). It rides the
// EXISTING `cost_budget_gate` inbox primitive (affordances + renderer already ship) so the reframe
// needs no migration; only the copy changes — "you hit your plan's limit," not "you blew your budget."
//
// Idempotent per (owner, period, feature): the dispatcher hits the gate on every blocked dispatch, but
// the owner should see ONE card per feature per month, not one per refused run. The card points at
// Settings → Tier & limits, where the only lever is upgrading (the customer can't raise a dollar cap).

import { createInboxItem, listInboxItems, type InboxItem } from "@/lib/pa-inbox-items";
import { periodStartDate } from "./db";
import type { UsageMetricKey, UsageUnit } from "./caps";

const SOURCE = "tier-limit";

export type TierLimitCardInput = {
  featureSlug: UsageMetricKey;
  featureLabel: string;
  unit: UsageUnit;
  used: number;
  cap: number;
  tierLabel: string;
  nextTierLabel: string | null;
};

function unitWord(unit: UsageUnit, n: number): string {
  if (unit === "minutes") return n === 1 ? "agent-minute" : "agent-minutes";
  return unit; // leads / hours / videos / connections / personas / runs already read as plurals here
}

/**
 * Stage the over-limit card if one isn't already pending for this (owner, period, feature). Returns the
 * existing or newly-created card id, or null if the staging write failed (the dispatcher logs the block
 * either way — a missing card must never silently swallow the gate). Service-role only.
 */
export async function stageTierLimitGateCard(
  ownerId: string,
  input: TierLimitCardInput,
  nowMs = Date.now(),
): Promise<string | null> {
  const period = periodStartDate(nowMs);

  // Dedup: one pending tier-limit card per owner per period per feature.
  const existing = await listInboxItems(ownerId);
  if (existing.ok) {
    const dupe = existing.data.find(
      (it: InboxItem) =>
        it.kind === "cost_budget_gate" &&
        it.status === "pending" &&
        it.payload?.period_start === period &&
        it.payload?.feature_slug === input.featureSlug,
    );
    if (dupe) return dupe.id;
  }

  const word = unitWord(input.unit, input.cap);
  const title = `You've used all of this month's ${input.featureLabel}`;
  const upgradeLine = input.nextTierLabel
    ? `Upgrade to ${input.nextTierLabel} for more, or it'll pick back up on its own when your plan resets next month.`
    : `It'll pick back up on its own when your plan resets next month.`;
  const body =
    `You've used all ${input.cap} ${word} on your ${input.tierLabel} plan this month, so new ` +
    `background runs are paused for now. Your chat still works normally — only new background jobs ` +
    `are held.\n\n${upgradeLine}`;

  const created = await createInboxItem({
    userId: ownerId,
    kind: "cost_budget_gate",
    title,
    bodyMd: body,
    source: SOURCE,
    payload: {
      period_start: period,
      feature_slug: input.featureSlug,
      used: input.used,
      cap: input.cap,
    },
  });
  return created.ok ? created.data.id : null;
}
