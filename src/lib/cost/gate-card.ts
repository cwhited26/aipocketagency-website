// gate-card.ts — stage the Mission Control `cost_budget_gate` card the dispatcher raises at >=100%
// instead of firing a new sub-agent run (Cost Observability SPEC §5.4/§8, PA-COST-14).
//
// Idempotent per (owner, period): the dispatcher hits the gate on every blocked dispatch, but the owner
// should see ONE card per month telling them they're over budget, not one per refused run. We dedup by
// scanning the owner's pending cost_budget_gate cards and skipping if this period already has one.
//
// The card is honest about its primitive: nothing is held in a queue to "release" (a refused dispatch
// isn't persisted), so the card's job is to tell the owner and point them at Settings → Budget to raise
// the cap. Resolving it (raise / wait) flows through the generic inbox approve/reject route.

import {
  createInboxItem,
  listInboxItems,
  type InboxItem,
} from "@/lib/pa-inbox-items";
import { periodStartDate } from "./budget";
import type { BudgetGate } from "./budget";

const SOURCE = "cost-budget";

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function dollarsFromMicro(microCents: number): string {
  return `$${(microCents / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Stage the over-budget gate card if one isn't already pending for this period. Returns the existing or
 * newly-created card id, or null if the staging write failed (the dispatcher logs the block either way —
 * a missing card must never silently swallow the gate). Service-role only.
 */
export async function stageCostBudgetGateCard(
  ownerId: string,
  gate: Extract<BudgetGate, { status: "block_100" }>,
  nowMs = Date.now(),
): Promise<string | null> {
  const period = periodStartDate(nowMs);

  // Dedup: one pending gate card per owner per period.
  const existing = await listInboxItems(ownerId);
  if (existing.ok) {
    const dupe = existing.data.find(
      (it: InboxItem) =>
        it.kind === "cost_budget_gate" &&
        it.status === "pending" &&
        it.payload?.period_start === period,
    );
    if (dupe) return dupe.id;
  }

  const cap = dollars(gate.budgetCents);
  const spent = dollarsFromMicro(gate.spentMicroCents);
  const title = `You've reached your ${cap} monthly cost budget`;
  const body =
    `Your agents have spent ${spent} this month — at or over your ${cap} cap. New background agent ` +
    `runs are paused for now so the bill can't run away. Your chat still works normally; only new ` +
    `background jobs are held.\n\n` +
    `Raise the cap in Settings → Budget to let them run again, or leave it and they'll resume on their ` +
    `own when the budget resets next month.`;

  const created = await createInboxItem({
    userId: ownerId,
    kind: "cost_budget_gate",
    title,
    bodyMd: body,
    source: SOURCE,
    payload: {
      period_start: period,
      budget_cents: gate.budgetCents,
      spent_micro_cents: gate.spentMicroCents,
      pct: Math.round(gate.pct),
    },
  });
  return created.ok ? created.data.id : null;
}
