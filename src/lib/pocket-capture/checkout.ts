// checkout.ts — Pocket Capture standalone ($47 one-time) Stripe Checkout param builder (PC-MARK-2).
//
// Pocket Capture is the standalone unbundling of PA's Capture Inbox primitive, sold as a $47 one-time
// impulse buy at the top of the value ladder (SPEC §3 / §3.1, PA-CAPTURE-1). It is its OWN product —
// not a member of the pocket_agent_addon catalog — so it carries its own metadata source
// (`pocket_capture_standalone`) the webhook branches on. Like every other one-time PA charge, the price
// is passed inline via price_data (no pre-created Stripe price id) using the same direct-REST, no-SDK
// pattern. Kept free of Next.js / Stripe / Supabase imports so the param shaping is unit-tested without
// hitting the network.

import {
  POCKET_CAPTURE_CANCEL_PATH,
  POCKET_CAPTURE_CHECKOUT_SOURCE,
  POCKET_CAPTURE_PRICE_CENTS,
  POCKET_CAPTURE_PRODUCT_NAME,
  POCKET_CAPTURE_SUCCESS_PATH,
} from "./product";

/**
 * Build the Stripe Checkout Session form params for the $47 Pocket Capture one-time charge.
 *
 * - `mode=payment` (one-time, not a subscription rung).
 * - Inline price_data — no pre-created Stripe price id, matching PA's direct-REST add-on pattern.
 * - `customer_email` is always collected so Stripe creates/attaches a customer and emails a receipt;
 *   the buyer is a fresh impulse visitor who may not have an account yet.
 * - source + email are stamped on BOTH the session and the resulting payment intent so the webhook can
 *   resolve the purchase from either object and ledger it idempotently.
 * - `userId` is threaded into client_reference_id + metadata only when the visitor was already signed in
 *   (rare for this funnel), so the ledger row can be linked to the account immediately.
 */
export function buildPocketCaptureCheckoutParams(args: {
  origin: string;
  email: string;
  userId: string | null;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("mode", "payment");

  // Inline price: one quantity, USD, whole-dollar one-time charge.
  params.set("line_items[0][price_data][currency]", "usd");
  params.set(
    "line_items[0][price_data][product_data][name]",
    POCKET_CAPTURE_PRODUCT_NAME,
  );
  params.set(
    "line_items[0][price_data][unit_amount]",
    String(POCKET_CAPTURE_PRICE_CENTS),
  );
  params.set("line_items[0][quantity]", "1");

  // Always collect the email — the buyer is a fresh visitor; this attaches a customer + sends a receipt.
  params.set("customer_email", args.email);

  // Stamp source + email on the session and the payment intent for idempotent webhook resolution.
  params.set("metadata[source]", POCKET_CAPTURE_CHECKOUT_SOURCE);
  params.set("metadata[email]", args.email);
  params.set("payment_intent_data[metadata][source]", POCKET_CAPTURE_CHECKOUT_SOURCE);
  params.set("payment_intent_data[metadata][email]", args.email);
  if (args.userId) {
    params.set("client_reference_id", args.userId);
    params.set("metadata[user_id]", args.userId);
  }

  params.set("success_url", `${args.origin}${POCKET_CAPTURE_SUCCESS_PATH}`);
  params.set("cancel_url", `${args.origin}${POCKET_CAPTURE_CANCEL_PATH}`);
  return params;
}
