// Pure Stripe Checkout helpers for the Pocket Agent /start?tier= flow (PA-ORCH-10
// provisioning fix). Kept free of Next.js / Supabase imports so the per-tier price
// routing and metadata stamping are unit-tested without hitting Stripe or the framework.

import { TIER_TO_PRICE, type PaidTier } from "@/lib/personas/tier-caps";

/**
 * Resolve the Stripe price for a paid tier. Starter prefers STRIPE_POCKET_AGENT_PRICE_ID
 * (preserves the pre-existing trial env wiring + test-mode override) and falls back to
 * the live mapping; every other tier reads straight from TIER_TO_PRICE. Returns null when
 * no price is configured for the tier.
 */
export function priceIdForCheckout(tier: PaidTier): string | null {
  if (tier === "starter") {
    return process.env.STRIPE_POCKET_AGENT_PRICE_ID ?? TIER_TO_PRICE.starter ?? null;
  }
  return TIER_TO_PRICE[tier] ?? null;
}

/**
 * Build the Stripe Checkout Session form params. Stamps source=pocket_agent + tier +
 * (when signed in) user_id into BOTH the session and the subscription metadata so the
 * webhook can provision the tier onto a pocket_agent_subscriptions row BEFORE Stripe
 * collects payment — closing the payment-link metadata gap.
 */
export function buildPocketAgentCheckoutParams(args: {
  email: string;
  name: string;
  tier: PaidTier;
  priceId: string;
  origin: string;
  userId: string | null;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("customer_email", args.email);
  params.set("line_items[0][price]", args.priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("subscription_data[trial_period_days]", "14");
  params.set("subscription_data[metadata][email]", args.email);
  params.set("subscription_data[metadata][source]", "pocket_agent");
  params.set("subscription_data[metadata][tier]", args.tier);
  if (args.name) {
    params.set("subscription_data[metadata][name]", args.name);
  }
  // When the user is authenticated, embed their id so the webhook can link the
  // subscription row to their account immediately on creation.
  if (args.userId) {
    params.set("client_reference_id", args.userId);
    params.set("subscription_data[metadata][user_id]", args.userId);
  }
  params.set("metadata[email]", args.email);
  params.set("metadata[source]", "pocket_agent");
  params.set("metadata[tier]", args.tier);
  if (args.name) {
    params.set("metadata[name]", args.name);
  }
  params.set(
    "success_url",
    `${args.origin}/pocket-agent/welcome?session_id={CHECKOUT_SESSION_ID}`,
  );
  params.set("cancel_url", `${args.origin}/pocket-agent`);
  return params;
}
