// product.ts — the Pocket Capture standalone product facts (PC-MARK-2, PA-CAPTURE-1).
//
// Single source of truth for the $47 one-time SKU: the price, the receipt name, the metadata source
// the Stripe webhook branches on, the ledger `kind`, the refund window, and the checkout redirect
// paths. Pure constants, no imports — every other module (checkout builder, refund math, route,
// webhook) reads from here so the price and source string are never duplicated.

// The metadata `source` the webhook keys on to route a completed checkout to the Pocket Capture
// standalone handler. Distinct from `pocket_agent` (subscription) and `pocket_agent_addon` (funnel
// add-ons) so the three flows never cross-fire.
export const POCKET_CAPTURE_CHECKOUT_SOURCE = "pocket_capture_standalone" as const;

// The `kind` written on the pocket_agent_addon_purchases ledger row (migration 065 — reused, no new
// migration this lane). The column is free-text (no CHECK), so a new kind needs no schema change.
export const POCKET_CAPTURE_ADDON_KIND = "pocket_capture_standalone" as const;

// $47, in cents — the locked impulse-buy price (SPEC §3.1: undercut MindChuk's $55, above PA Starter's
// $37/mo mental anchor). Single source of truth for both the checkout line item and the ledger amount.
export const POCKET_CAPTURE_PRICE_CENTS = 4_700;

// The display name on the Stripe receipt line item.
export const POCKET_CAPTURE_PRODUCT_NAME = "Pocket Capture";

// 30 days money-back, no questions asked (SPEC PC-Q8). Measured from when payment cleared.
export const POCKET_CAPTURE_REFUND_WINDOW_DAYS = 30;

// Post-checkout redirect. Stripe substitutes the literal {CHECKOUT_SESSION_ID} template at redirect
// time; the welcome page reads it to confirm the purchase. cancel_url returns to the standalone
// landing page (PC-MARK-1).
export const POCKET_CAPTURE_SUCCESS_PATH =
  "/capture/welcome?session_id={CHECKOUT_SESSION_ID}";
export const POCKET_CAPTURE_CANCEL_PATH = "/capture";
