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

// The order-form bump (PA-FUNNEL): the Fast-Start Brain Import, a one-time $49 add-on offered as a
// checkbox on /start. We pre-fill the buyer's Business Brain from their existing notes, last 50 sent
// emails, and site before day one. Charged once on the first invoice via Stripe's add_invoice_items
// (a one-time line item layered onto a subscription Checkout) so it doesn't need its own session.
export const FAST_START_BRAIN_IMPORT_CENTS = 4_900;

// The second order-form bump (PA-VAULT-2): the AI Workflow Vault, a one-time $47 add-on offered as a
// checkbox on /start. It unlocks all 25 plug-and-play recipes. Like the Fast-Start import, it rides the
// first invoice via add_invoice_items rather than a second checkout session, so the buyer pays once.
// metadata[bump_workflow_vault] lets the webhook write the pocket_agent_addon_purchases unlock row.
export const WORKFLOW_VAULT_CENTS = 4_700;

/**
 * Build the Stripe Checkout Session form params. Stamps source=pocket_agent + tier +
 * (when signed in) user_id into BOTH the session and the subscription metadata so the
 * webhook can provision the tier onto a pocket_agent_subscriptions row BEFORE Stripe
 * collects payment — closing the payment-link metadata gap. On success the buyer lands on
 * /upsell (the post-checkout Done-With-You offer), carrying the session id so the upsell
 * charge can be tied to the same Stripe customer. When `bump` is set, a one-time Fast-Start
 * Brain Import line is added to the first invoice.
 */
export function buildPocketAgentCheckoutParams(args: {
  email: string;
  name: string;
  tier: PaidTier;
  priceId: string;
  origin: string;
  userId: string | null;
  bump?: boolean;
  vault?: boolean;
  // Launch-funnel mode (start.aipocketagent.com): route success/cancel back onto the funnel's own
  // pages and stamp the quiz answers for attribution. Cold funnel traffic isn't signed in, so the
  // encoded answers stand in for client_reference_id when there's no user_id.
  funnel?: boolean;
  funnelAnswers?: string;
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
  } else if (args.funnel) {
    // No account yet (cold funnel) — carry the encoded quiz answers as the attribution handle.
    params.set("client_reference_id", `funnel:${args.funnelAnswers ?? ""}`);
  }
  params.set("metadata[email]", args.email);
  params.set("metadata[source]", "pocket_agent");
  params.set("metadata[tier]", args.tier);
  if (args.name) {
    params.set("metadata[name]", args.name);
  }
  if (args.funnel) {
    params.set("metadata[funnel_source]", "launch_funnel");
    params.set("subscription_data[metadata][funnel_source]", "launch_funnel");
    if (args.funnelAnswers) {
      params.set("metadata[funnel_answers]", args.funnelAnswers);
      params.set(
        "subscription_data[metadata][funnel_answers]",
        args.funnelAnswers,
      );
    }
  }
  // One-time bumps ride add_invoice_items on the first invoice. The index walks forward so the two
  // bumps can stack without colliding (Fast-Start at [0], Vault at [0] or [1]).
  let invoiceItemIndex = 0;
  if (args.bump) {
    const i = invoiceItemIndex++;
    params.set(
      `subscription_data[add_invoice_items][${i}][price_data][currency]`,
      "usd",
    );
    params.set(
      `subscription_data[add_invoice_items][${i}][price_data][product_data][name]`,
      "Fast-Start Brain Import",
    );
    params.set(
      `subscription_data[add_invoice_items][${i}][price_data][unit_amount]`,
      String(FAST_START_BRAIN_IMPORT_CENTS),
    );
    params.set(`subscription_data[add_invoice_items][${i}][quantity]`, "1");
    params.set("metadata[bump_fast_start_brain_import]", "true");
  }
  if (args.vault) {
    const i = invoiceItemIndex++;
    params.set(
      `subscription_data[add_invoice_items][${i}][price_data][currency]`,
      "usd",
    );
    params.set(
      `subscription_data[add_invoice_items][${i}][price_data][product_data][name]`,
      "AI Workflow Vault (all 25 recipes)",
    );
    params.set(
      `subscription_data[add_invoice_items][${i}][price_data][unit_amount]`,
      String(WORKFLOW_VAULT_CENTS),
    );
    params.set(`subscription_data[add_invoice_items][${i}][quantity]`, "1");
    // Flag on BOTH the session (checkout.session.completed) and the subscription
    // (customer.subscription.created) so whichever the webhook sees first can unlock the Vault.
    params.set("metadata[bump_workflow_vault]", "true");
    params.set("subscription_data[metadata][bump_workflow_vault]", "true");
  }
  if (args.funnel) {
    // The funnel runs on start.aipocketagent.com, where /upsell and /pricing don't exist —
    // land on the funnel's own /success and bounce a cancel back to the offer page.
    params.set(
      "success_url",
      `${args.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    );
    params.set("cancel_url", `${args.origin}/start`);
  } else {
    params.set(
      "success_url",
      `${args.origin}/upsell?session_id={CHECKOUT_SESSION_ID}`,
    );
    params.set("cancel_url", `${args.origin}/pricing`);
  }
  return params;
}
