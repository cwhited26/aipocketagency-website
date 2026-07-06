// lib/workshop/product.ts — the Business Brain Workshop money model (PA-POS-38, Positioning Lock
// §24.2–24.3). Pure: no Next.js / Supabase / Stripe imports, so the checkout params, the OTO
// PaymentIntent params, and the honest value math are unit-tested without hitting anything.
//
// The offer: $97 today buys the 60-minute workshop + workbook + template repo + Skool lifetime +
// 30 days of Business Agent tier. The subscription is the shipped pro rung ($97/mo) with
// trial_period_days=30; the $97 workshop price rides the first invoice via add_invoice_items —
// the same mechanism as the shipped Fast-Start Bump (pocket-agent-checkout.ts), so the buyer pays
// once at checkout and day 31 bills the tier unless they cancel.

import { TIER_TO_PRICE } from "@/lib/personas/tier-caps";

/** Session-level metadata source — the workshop webhook claims these; the main webhook skips them. */
export const WORKSHOP_CHECKOUT_SOURCE = "pa_workshop";

/** $97 — the workshop, charged today on the first invoice. */
export const WORKSHOP_PRICE_CENTS = 9_700;

/** +$27 — the Fast-Start Brain Import order-form bump (§24.3 step 1). */
export const WORKSHOP_BUMP_CENTS = 2_700;
export const WORKSHOP_BUMP_SLUG = "fast_start_brain_import";

/** OTO 1 — $997 Done-With-You Setup Sprint (§24.3 step 2). Reuses the shipped Setup Sprint SKU. */
export const WORKSHOP_OTO1_CENTS = 99_700;
export const WORKSHOP_OTO1_SLUG = "setup_sprint";

/** OTO 2 — $297 Backstage Pass, lifetime (§24.3 step 3). Shown only if OTO 1 was declined. */
export const WORKSHOP_OTO2_CENTS = 29_700;
export const WORKSHOP_OTO2_SLUG = "backstage_pass";

// ── Honest value math (§24.7): "$194 of value. You pay $97 today." ────────────────────────────────
// $97 workshop + $97 first month of Business Agent (included free for 30 days) = $194. No inflated
// "$594 value!!!" stack — the two real numbers, added.
export const WORKSHOP_VALUE_ITEMS = [
  { label: "The Business Brain Workshop (60 minutes, workbook, template repo)", cents: 9_700 },
  { label: "30 days of Pocket Agent Business Agent tier", cents: 9_700 },
] as const;

export const WORKSHOP_VALUE_TOTAL_CENTS = 19_400;

/** The tier the bundle provisions and the price it renews at on day 31. */
export const WORKSHOP_TIER = "pro" as const;
export const WORKSHOP_RENEWAL_CENTS = 9_700;
export const WORKSHOP_TRIAL_DAYS = 30;

export function workshopSubscriptionPriceId(): string | null {
  return TIER_TO_PRICE[WORKSHOP_TIER] ?? null;
}

/** Dollar string for copy, e.g. 9700 → "$97". Whole dollars only — no cents in customer copy. */
export function formatWorkshopPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

// ── Checkout Session params ───────────────────────────────────────────────────────────────────────

/**
 * Build the workshop Checkout Session form params (direct REST, form-encoded).
 *
 * Session metadata carries source=pa_workshop + the registration id so the workshop webhook can
 * stamp the registration. Subscription metadata carries source=pocket_agent + tier=pro so the
 * SHIPPED subscription.created handler provisions the workspace exactly like a /start buyer —
 * account resolution, tier write, login link, onboarding sequence, Launch Kit seed. The workshop
 * webhook layers the workshop-specific work (slot emails, bump ledger, trial_source) on top.
 */
export function buildWorkshopCheckoutParams(args: {
  email: string;
  name: string;
  registrationId: string;
  priceId: string;
  origin: string;
  bump: boolean;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("customer_email", args.email);
  params.set("line_items[0][price]", args.priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("subscription_data[trial_period_days]", String(WORKSHOP_TRIAL_DAYS));
  params.set("subscription_data[metadata][email]", args.email);
  params.set("subscription_data[metadata][source]", "pocket_agent");
  params.set("subscription_data[metadata][tier]", WORKSHOP_TIER);
  params.set("subscription_data[metadata][trial_source]", "workshop");
  params.set("subscription_data[metadata][workshop_registration_id]", args.registrationId);
  params.set("subscription_data[metadata][anonymous_signup]", "true");
  if (args.name) {
    params.set("subscription_data[metadata][name]", args.name);
    params.set("metadata[name]", args.name);
  }
  params.set("metadata[source]", WORKSHOP_CHECKOUT_SOURCE);
  params.set("metadata[email]", args.email);
  params.set("metadata[registration_id]", args.registrationId);
  params.set("metadata[anonymous_signup]", "true");

  // The $97 workshop rides the first invoice as a one-time line (the trial covers the recurring
  // price, so this is the only charge today).
  params.set("subscription_data[add_invoice_items][0][price_data][currency]", "usd");
  params.set(
    "subscription_data[add_invoice_items][0][price_data][product_data][name]",
    "The Business Brain Workshop",
  );
  params.set(
    "subscription_data[add_invoice_items][0][price_data][unit_amount]",
    String(WORKSHOP_PRICE_CENTS),
  );
  params.set("subscription_data[add_invoice_items][0][quantity]", "1");

  if (args.bump) {
    params.set("subscription_data[add_invoice_items][1][price_data][currency]", "usd");
    params.set(
      "subscription_data[add_invoice_items][1][price_data][product_data][name]",
      "Fast-Start Brain Import",
    );
    params.set(
      "subscription_data[add_invoice_items][1][price_data][unit_amount]",
      String(WORKSHOP_BUMP_CENTS),
    );
    params.set("subscription_data[add_invoice_items][1][quantity]", "1");
    params.set("metadata[bump_fast_start_brain_import]", "true");
  }

  params.set("success_url", `${args.origin}/workshop/oto/1?session={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${args.origin}/workshop`);
  return params;
}

// ── OTO PaymentIntent params ──────────────────────────────────────────────────────────────────────

export type WorkshopOtoNumber = 1 | 2;

export function otoMeta(n: WorkshopOtoNumber): { slug: string; name: string; amountCents: number } {
  return n === 1
    ? { slug: WORKSHOP_OTO1_SLUG, name: "Done-With-You Setup Sprint", amountCents: WORKSHOP_OTO1_CENTS }
    : { slug: WORKSHOP_OTO2_SLUG, name: "Backstage Pass (lifetime)", amountCents: WORKSHOP_OTO2_CENTS };
}

/**
 * Build the off-session PaymentIntent params for an OTO yes. Charges the payment method saved by
 * the workshop Checkout Session — no card re-entry on the OTO pages (§24.3: one yes button).
 */
export function buildOtoPaymentIntentParams(args: {
  oto: WorkshopOtoNumber;
  customerId: string;
  paymentMethodId: string;
  registrationId: string;
}): URLSearchParams {
  const meta = otoMeta(args.oto);
  const params = new URLSearchParams();
  params.set("amount", String(meta.amountCents));
  params.set("currency", "usd");
  params.set("customer", args.customerId);
  params.set("payment_method", args.paymentMethodId);
  params.set("off_session", "true");
  params.set("confirm", "true");
  params.set("description", meta.name);
  params.set("metadata[source]", "pa_workshop_oto");
  params.set("metadata[registration_id]", args.registrationId);
  params.set("metadata[oto_number]", String(args.oto));
  params.set("metadata[product_slug]", meta.slug);
  return params;
}
