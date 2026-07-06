// lib/workshop/stripe.ts — direct-REST Stripe calls for the workshop funnel (no SDK, standing
// rule). Checkout session creation, session retrieval, saved-payment-method resolution for the
// OTO charges, off-session PaymentIntent creation, and webhook signature verification.

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { buildOtoPaymentIntentParams, type WorkshopOtoNumber } from "./product";

const STRIPE_API = "https://api.stripe.com/v1";
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type StripeResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function stripeSecret(): string | null {
  return process.env.STRIPE_SECRET_KEY ?? null;
}

async function stripePost<T>(path: string, params: URLSearchParams): Promise<StripeResult<T>> {
  const secret = stripeSecret();
  if (!secret) return { ok: false, status: 500, error: "STRIPE_SECRET_KEY not set" };
  const res = await fetch(`${STRIPE_API}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 800) };
  return { ok: true, data: JSON.parse(text) as T };
}

async function stripeGet<T>(path: string): Promise<StripeResult<T>> {
  const secret = stripeSecret();
  if (!secret) return { ok: false, status: 500, error: "STRIPE_SECRET_KEY not set" };
  const res = await fetch(`${STRIPE_API}/${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 800) };
  return { ok: true, data: JSON.parse(text) as T };
}

// ── Checkout ─────────────────────────────────────────────────────────────────────────────────────

const CheckoutSessionSchema = z.object({
  id: z.string(),
  url: z.string().nullish(),
  customer: z.string().nullable(),
  subscription: z.string().nullable(),
  payment_status: z.string().optional(),
  metadata: z.record(z.string(), z.string()).nullable(),
});
export type WorkshopCheckoutSession = z.infer<typeof CheckoutSessionSchema>;

export async function createWorkshopCheckoutSession(
  params: URLSearchParams,
): Promise<StripeResult<WorkshopCheckoutSession>> {
  const r = await stripePost<unknown>("checkout/sessions", params);
  if (!r.ok) return r;
  const parsed = CheckoutSessionSchema.safeParse(r.data);
  if (!parsed.success) return { ok: false, status: 502, error: "checkout session shape invalid" };
  return { ok: true, data: parsed.data };
}

export async function retrieveWorkshopCheckoutSession(
  sessionId: string,
): Promise<StripeResult<WorkshopCheckoutSession>> {
  const r = await stripeGet<unknown>(`checkout/sessions/${encodeURIComponent(sessionId)}`);
  if (!r.ok) return r;
  const parsed = CheckoutSessionSchema.safeParse(r.data);
  if (!parsed.success) return { ok: false, status: 502, error: "checkout session shape invalid" };
  return { ok: true, data: parsed.data };
}

// ── Saved payment method (the OTO one-click charge) ──────────────────────────────────────────────

const SubscriptionPmSchema = z.object({
  default_payment_method: z.string().nullable().optional(),
});

const PaymentMethodListSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
});

/**
 * The payment method the workshop checkout saved: the subscription's default_payment_method
 * (Checkout sets it on trial subscriptions), falling back to the customer's first card.
 */
export async function resolveSavedPaymentMethod(args: {
  customerId: string;
  subscriptionId: string | null;
}): Promise<StripeResult<string>> {
  if (args.subscriptionId) {
    const sub = await stripeGet<unknown>(`subscriptions/${encodeURIComponent(args.subscriptionId)}`);
    if (sub.ok) {
      const parsed = SubscriptionPmSchema.safeParse(sub.data);
      if (parsed.success && parsed.data.default_payment_method) {
        return { ok: true, data: parsed.data.default_payment_method };
      }
    }
  }
  const list = await stripeGet<unknown>(
    `customers/${encodeURIComponent(args.customerId)}/payment_methods?type=card&limit=1`,
  );
  if (!list.ok) return list;
  const parsed = PaymentMethodListSchema.safeParse(list.data);
  const pm = parsed.success ? parsed.data.data[0]?.id : undefined;
  if (!pm) return { ok: false, status: 404, error: "no saved payment method on customer" };
  return { ok: true, data: pm };
}

// ── Off-session PaymentIntent (OTO yes) ──────────────────────────────────────────────────────────

const PaymentIntentSchema = z.object({
  id: z.string(),
  status: z.string(),
  last_payment_error: z
    .object({ message: z.string().optional(), code: z.string().optional() })
    .nullable()
    .optional(),
});
export type WorkshopPaymentIntent = z.infer<typeof PaymentIntentSchema>;

export async function chargeWorkshopOto(args: {
  oto: WorkshopOtoNumber;
  customerId: string;
  paymentMethodId: string;
  registrationId: string;
}): Promise<StripeResult<WorkshopPaymentIntent>> {
  const params = buildOtoPaymentIntentParams(args);
  const r = await stripePost<unknown>("payment_intents", params);
  if (!r.ok) {
    // A declined off-session charge comes back 402 with the PI embedded in the error body —
    // surface the status code; the route records a failed OTO row.
    return r;
  }
  const parsed = PaymentIntentSchema.safeParse(r.data);
  if (!parsed.success) return { ok: false, status: 502, error: "payment intent shape invalid" };
  return { ok: true, data: parsed.data };
}

// ── Webhook signature (same scheme as the main webhook, duplicated because Next.js route files
// can only export handlers) ──────────────────────────────────────────────────────────────────────

export function verifyWorkshopStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowMs: number = Date.now(),
): { ok: true } | { ok: false; reason: string } {
  if (!signatureHeader) return { ok: false, reason: "missing signature header" };
  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    if (k === "t") timestamp = v;
    else if (k === "v1") signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) {
    return { ok: false, reason: "malformed signature header" };
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "non-numeric timestamp" };
  const ageSec = Math.abs(nowMs / 1000 - ts);
  if (ageSec > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: `timestamp outside tolerance (${ageSec}s)` };
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  for (const sig of signatures) {
    const sigBuf = Buffer.from(sig, "utf8");
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "no matching v1 signature" };
}
