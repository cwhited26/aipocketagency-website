// Pocket Agent SMB-tier provisioning from Stripe subscription events (PA-ORCH-10).
// Lives in lib (not the route module) so it can be exported + unit-tested — Next.js route
// files may only export HTTP-method handlers. The Stripe webhook calls
// applyPocketAgentTierFromSubscription on customer.subscription.created/updated.

import {
  fetchPocketAgentBySubscriptionId,
  markPocketAgentTier,
  setPocketAgentAddonByCustomer,
  upsertPocketAgentTrial,
} from "@/lib/pocket-agent-supabase";
import {
  getAddonFromStripePriceId,
  resolveProvisionTier,
} from "@/lib/personas/tier-caps";

type StripeSubscriptionItem = {
  price: { id: string } | null;
};

export type StripeSubscription = {
  id: string;
  customer: string | null;
  status: string;
  trial_start: number | null;
  trial_end: number | null;
  metadata: Record<string, string> | null;
  items?: { data?: StripeSubscriptionItem[] } | null;
};

/** Pull the active price IDs off a Stripe subscription's line items. */
export function extractPriceIds(sub: StripeSubscription): string[] {
  const items = sub.items?.data ?? [];
  return items
    .map((it) => it.price?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/**
 * Resolve the SMB tier (and any dev add-ons) from a subscription's active prices and
 * persist them (PA-ORCH-10 + SPEC v4 Wave 3). Called on customer.subscription.created
 * and .updated. Three independent classifications per subscription:
 *
 *  1. SMB ladder price  → write the highest tier to the row (keyed by subscription id).
 *  2. Dev add-on price  → set the orthogonal addon flag (keyed by customer id). Never
 *                         touches `tier`, so an add-on subscription can't clobber the
 *                         primary tier.
 *  3. Neither           → ignore (not a PA-priced subscription).
 *
 * Tier transitions are logged ("upgraded from pro to studio") so plan moves are auditable.
 */
export async function applyPocketAgentTierFromSubscription(
  sub: StripeSubscription,
  trigger: "created" | "updated",
): Promise<void> {
  const priceIds = extractPriceIds(sub);
  if (priceIds.length === 0) {
    console.warn("[stripe/webhook] subscription has no line-item prices; cannot resolve tier", {
      subscription_id: sub.id,
      trigger,
    });
    return;
  }

  // (2) Dev add-ons — set flags by customer, independent of the SMB tier.
  if (sub.customer) {
    for (const priceId of priceIds) {
      const addon = getAddonFromStripePriceId(priceId);
      if (!addon) continue;
      const set = await setPocketAgentAddonByCustomer({
        stripeCustomerId: sub.customer,
        addon,
        enabled: true,
      });
      if (!set.ok) {
        console.error("[stripe/webhook] failed to set pocket_agent add-on flag", {
          subscription_id: sub.id,
          customer: sub.customer,
          addon,
          status: set.status,
          error: set.error,
        });
      } else {
        console.info("[stripe/webhook] pocket_agent add-on enabled", {
          subscription_id: sub.id,
          customer: sub.customer,
          addon,
          trigger,
        });
      }
    }
  }

  // (1) SMB ladder tier — the active price ID is the source of truth (highest tier wins
  // when several are stacked); metadata.tier, stamped by the /start?tier= checkout flow,
  // is a validated fallback for the rare case a price isn't in the map yet.
  const tier = resolveProvisionTier({ priceIds, metadataTier: sub.metadata?.tier });
  if (!tier) {
    // Add-on-only subscription (or a non-PA price). Nothing more to do.
    return;
  }

  const lookup = await fetchPocketAgentBySubscriptionId(sub.id);
  if (!lookup.ok) {
    console.error("[stripe/webhook] tier write: subscription lookup failed", {
      subscription_id: sub.id,
      status: lookup.status,
      error: lookup.error,
    });
    return;
  }

  if (!lookup.row) {
    // Defense in depth: a paid SMB subscription exists in Stripe but has no
    // pocket_agent_subscriptions row to attach the tier to. The /start?tier= flow always
    // creates the row first (via checkout.session.completed), so this is the legacy
    // payment-link path. When the subscription carries enough metadata (email + customer)
    // we provision the row here on the fly so the customer still gets their tier; only a
    // truly metadata-less payment-link purchase stays an unprovisionable blocker.
    const provisioned = await provisionMissingTierRow(sub, tier, trigger);
    if (!provisioned) {
      console.error(
        "[stripe/webhook] PA SMB subscription has no pocket_agent_subscriptions row and lacks metadata to create one — payment collected but tier NOT provisioned (payment-link metadata gap)",
        {
          subscription_id: sub.id,
          customer: sub.customer,
          resolved_tier: tier,
          trigger,
        },
      );
    }
    return;
  }

  const prevTier = lookup.row.tier;
  if (prevTier === tier) return; // No-op transition (e.g. unrelated update event).

  const mark = await markPocketAgentTier(sub.id, tier);
  if (!mark.ok) {
    console.error("[stripe/webhook] failed to write pocket_agent tier", {
      subscription_id: sub.id,
      from: prevTier ?? "(none)",
      to: tier,
      status: mark.status,
      error: mark.error,
    });
    return;
  }
  console.info("[stripe/webhook] pocket_agent tier transition", {
    subscription_id: sub.id,
    customer: sub.customer,
    email: lookup.row.email,
    from: prevTier ?? "(none)",
    to: tier,
    trigger,
  });
}

/**
 * Create a pocket_agent_subscriptions row for a subscription that has none, then stamp
 * its tier. Used only as a defense-in-depth fallback when the up-front checkout row is
 * missing (legacy payment-link path). Returns false when there isn't enough metadata
 * (email + customer) to create a usable row — the caller logs the blocker in that case.
 */
async function provisionMissingTierRow(
  sub: StripeSubscription,
  tier: string,
  trigger: "created" | "updated",
): Promise<boolean> {
  const email = sub.metadata?.email ?? null;
  if (!email || !sub.customer) return false;

  const trialStartedAt = sub.trial_start
    ? new Date(sub.trial_start * 1000).toISOString()
    : new Date().toISOString();
  const trialEndsAt = sub.trial_end
    ? new Date(sub.trial_end * 1000).toISOString()
    : null;

  const upsert = await upsertPocketAgentTrial({
    email,
    name: sub.metadata?.name ?? null,
    userId: sub.metadata?.user_id ?? null,
    stripeCustomerId: sub.customer,
    stripeSubscriptionId: sub.id,
    stripeSessionId: null,
    trialStartedAt,
    trialEndsAt,
  });
  if (!upsert.ok) {
    console.error("[stripe/webhook] defense-in-depth row creation failed", {
      subscription_id: sub.id,
      customer: sub.customer,
      status: upsert.status,
      error: upsert.error,
    });
    return false;
  }

  const mark = await markPocketAgentTier(sub.id, tier);
  if (!mark.ok) {
    console.error("[stripe/webhook] tier write after row creation failed", {
      subscription_id: sub.id,
      to: tier,
      status: mark.status,
      error: mark.error,
    });
    return false;
  }

  console.info(
    "[stripe/webhook] pocket_agent row provisioned on the fly + tier written (payment-link fallback)",
    { subscription_id: sub.id, customer: sub.customer, to: tier, trigger },
  );
  return true;
}
