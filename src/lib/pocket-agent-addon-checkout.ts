// Pure Stripe Checkout param builder for the funnel's one-time add-on charges (PA-FUNNEL).
//
// Mirrors pocket-agent-checkout.ts (the subscription flow) but for mode=payment one-time products:
// the Done-With-You Setup ($997/$2,500) on /upsell and the $97 Pilot on /downsell. The price is
// passed inline via price_data (no pre-created Stripe price ID needed), the charge is tied to the
// prior subscription customer when we have one, and metadata stamps source=pocket_agent_addon +
// addon_kind so the webhook can ledger the purchase and send the right email. Kept free of Next.js /
// Stripe / Supabase imports so the param shaping is unit-tested without hitting the network.

import {
  getAddonMeta,
  type AddonCheckoutKind,
} from "@/lib/pocket-agent-addons";

/**
 * Build the Stripe Checkout Session form params for a one-time add-on charge.
 *
 * - `customerId` is set for the /upsell setup charges (the customer created by the prior
 *   subscription checkout), so the charge lands on the same Stripe customer. When null (the
 *   /downsell pilot bought by a fresh visitor) we fall back to customer_email so Stripe still
 *   creates/attaches a customer and we can email a receipt.
 * - `successPath` and `cancelPath` are passed in by the route so this stays framework-free.
 */
export function buildAddonCheckoutParams(args: {
  kind: AddonCheckoutKind;
  origin: string;
  successPath: string;
  cancelPath: string;
  email: string | null;
  customerId: string | null;
  userId: string | null;
}): URLSearchParams {
  const meta = getAddonMeta(args.kind);
  const params = new URLSearchParams();
  params.set("mode", "payment");

  // Inline price (no pre-created Stripe price). One quantity, USD, whole-dollar one-time charge.
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][product_data][name]", meta.name);
  params.set("line_items[0][price_data][unit_amount]", String(meta.amountCents));
  params.set("line_items[0][quantity]", "1");

  // Tie to the prior customer when we have one; otherwise collect/attach by email.
  if (args.customerId) {
    params.set("customer", args.customerId);
  } else if (args.email) {
    params.set("customer_email", args.email);
  }

  // Stamp source + kind on BOTH the session and the resulting payment intent so the webhook can
  // resolve the purchase from either object and ledger it idempotently.
  params.set("metadata[source]", "pocket_agent_addon");
  params.set("metadata[addon_kind]", args.kind);
  params.set("payment_intent_data[metadata][source]", "pocket_agent_addon");
  params.set("payment_intent_data[metadata][addon_kind]", args.kind);
  if (args.email) {
    params.set("metadata[email]", args.email);
  }
  if (args.userId) {
    params.set("client_reference_id", args.userId);
    params.set("metadata[user_id]", args.userId);
  }

  params.set("success_url", `${args.origin}${args.successPath}`);
  params.set("cancel_url", `${args.origin}${args.cancelPath}`);
  return params;
}
