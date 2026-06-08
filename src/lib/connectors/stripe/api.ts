// connectors/stripe/api.ts — Stripe API REST client (direct fetch, no SDK).
//
// Every connected-account call authenticates with the PLATFORM secret key as the Bearer token
// and sets the Stripe-Account header to the connected account id (acct_…) — this is how the
// platform acts ON BEHALF of the owner's connected Standard account. The action modules build
// the request params (pure) and call these; only these functions touch the network. Responses
// are validated with Zod at the boundary, so nothing downstream sees `any`.
//
// Idempotency: every mutating call takes an idempotencyKey (derived deterministically from the
// approval id upstream — roadmap §3.2) and sends it as the Idempotency-Key header so a retry or
// crash-resume never double-charges, double-invoices, or double-refunds.

import { z } from "zod";

const BASE = "https://api.stripe.com/v1";

export type StripeApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

export type StripeCallContext = {
  /** Platform secret key (Bearer credential). */
  secretKey: string;
  /** Connected account id (acct_…) — sent as the Stripe-Account header. */
  accountId: string;
};

// 401/403 (revoked key) or an account_invalid / no-longer-connected error means the connection
// is dead and the owner must reconnect.
function isAuthFailure(status: number, body: string): boolean {
  if (status === 401 || status === 403) return true;
  return body.includes("account_invalid") || body.includes("does not have access to account");
}

function baseHeaders(ctx: StripeCallContext): Record<string, string> {
  return {
    Authorization: `Bearer ${ctx.secretKey}`,
    "Stripe-Account": ctx.accountId,
  };
}

// Stripe's error envelope: { error: { message, code, type } }. Pull the human message out.
const ErrorEnvelopeSchema = z.object({
  error: z.object({ message: z.string().optional(), code: z.string().optional() }).optional(),
});

function extractError(text: string, status: number): string {
  try {
    const parsed = ErrorEnvelopeSchema.safeParse(JSON.parse(text));
    const msg = parsed.success ? parsed.data.error?.message : undefined;
    return msg ?? `Stripe request failed (${status})`;
  } catch {
    return `Stripe request failed (${status})`;
  }
}

async function parseJson<T>(res: Response, schema: z.ZodType<T>): Promise<StripeApiResult<T>> {
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: extractError(text, res.status), authError: isAuthFailure(res.status, text) };
  }
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, status: 502, error: "Stripe returned non-JSON", authError: false };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 502, error: "Stripe response shape invalid", authError: false };
  }
  return { ok: true, data: parsed.data };
}

async function stripeGet<T>(
  ctx: StripeCallContext,
  path: string,
  query: Record<string, string | number>,
  schema: z.ZodType<T>,
): Promise<StripeApiResult<T>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) qs.set(k, String(v));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`${BASE}${path}${suffix}`, {
    method: "GET",
    headers: baseHeaders(ctx),
    cache: "no-store",
  });
  return parseJson(res, schema);
}

async function stripePost<T>(
  ctx: StripeCallContext,
  path: string,
  params: Record<string, string | number | boolean>,
  schema: z.ZodType<T>,
  idempotencyKey?: string,
): Promise<StripeApiResult<T>> {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));
  const headers: Record<string, string> = {
    ...baseHeaders(ctx),
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: body.toString(),
    cache: "no-store",
  });
  return parseJson(res, schema);
}

// ─── Response shapes (the subset each action reads) ────────────────────────────────

export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});
export type StripeCustomer = z.infer<typeof CustomerSchema>;

const CustomerListSchema = z.object({
  data: z.array(CustomerSchema),
  has_more: z.boolean().optional(),
});

export const InvoiceSchema = z.object({
  id: z.string(),
  number: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  amount_due: z.number().optional(),
  currency: z.string().optional(),
  customer: z.string().nullable().optional(),
  hosted_invoice_url: z.string().nullable().optional(),
});
export type StripeInvoice = z.infer<typeof InvoiceSchema>;

const InvoiceListSchema = z.object({
  data: z.array(InvoiceSchema),
  has_more: z.boolean().optional(),
});

const BalanceAmountSchema = z.object({ amount: z.number(), currency: z.string() });
export const BalanceSchema = z.object({
  available: z.array(BalanceAmountSchema),
  pending: z.array(BalanceAmountSchema),
});
export type StripeBalance = z.infer<typeof BalanceSchema>;

const InvoiceItemSchema = z.object({ id: z.string() });
const PriceSchema = z.object({ id: z.string() });

export const PaymentLinkSchema = z.object({ id: z.string(), url: z.string() });
export type StripePaymentLink = z.infer<typeof PaymentLinkSchema>;

export const ChargeSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  customer: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  created: z.number().optional(),
  refunded: z.boolean().optional(),
  amount_refunded: z.number().optional(),
});
export type StripeCharge = z.infer<typeof ChargeSchema>;

export const RefundSchema = z.object({
  id: z.string(),
  status: z.string().nullable().optional(),
  amount: z.number(),
  currency: z.string(),
  charge: z.string().nullable().optional(),
});
export type StripeRefund = z.infer<typeof RefundSchema>;

// ─── Reads ──────────────────────────────────────────────────────────────────────

export function listCustomers(
  ctx: StripeCallContext,
  limit: number,
): Promise<StripeApiResult<{ data: StripeCustomer[]; has_more?: boolean }>> {
  return stripeGet(ctx, "/customers", { limit }, CustomerListSchema);
}

export function listInvoices(
  ctx: StripeCallContext,
  query: { limit: number; customer?: string; status?: string },
): Promise<StripeApiResult<{ data: StripeInvoice[]; has_more?: boolean }>> {
  const q: Record<string, string | number> = { limit: query.limit };
  if (query.customer) q.customer = query.customer;
  if (query.status) q.status = query.status;
  return stripeGet(ctx, "/invoices", q, InvoiceListSchema);
}

export function getBalance(ctx: StripeCallContext): Promise<StripeApiResult<StripeBalance>> {
  return stripeGet(ctx, "/balance", {}, BalanceSchema);
}

export function retrieveCharge(
  ctx: StripeCallContext,
  chargeId: string,
): Promise<StripeApiResult<StripeCharge>> {
  return stripeGet(ctx, `/charges/${encodeURIComponent(chargeId)}`, {}, ChargeSchema);
}

// ─── Writes ───────────────────────────────────────────────────────────────────────

/** Create a single invoice line item (a pending charge attached to a customer). */
export function createInvoiceItem(
  ctx: StripeCallContext,
  params: { customer: string; amount: number; currency: string; description?: string },
  idempotencyKey: string,
): Promise<StripeApiResult<{ id: string }>> {
  const body: Record<string, string | number> = {
    customer: params.customer,
    amount: params.amount,
    currency: params.currency,
  };
  if (params.description) body.description = params.description;
  return stripePost(ctx, "/invoiceitems", body, InvoiceItemSchema, idempotencyKey);
}

/** Create a draft invoice that sweeps up the customer's pending invoice items. */
export function createInvoice(
  ctx: StripeCallContext,
  params: { customer: string; daysUntilDue?: number; description?: string },
  idempotencyKey: string,
): Promise<StripeApiResult<StripeInvoice>> {
  const body: Record<string, string | number | boolean> = {
    customer: params.customer,
    collection_method: "send_invoice",
    days_until_due: params.daysUntilDue ?? 30,
    auto_advance: true,
  };
  if (params.description) body.description = params.description;
  return stripePost(ctx, "/invoices", body, InvoiceSchema, idempotencyKey);
}

/** Finalize a draft invoice so it gets a number + hosted payment page. */
export function finalizeInvoice(
  ctx: StripeCallContext,
  invoiceId: string,
  idempotencyKey: string,
): Promise<StripeApiResult<StripeInvoice>> {
  return stripePost(
    ctx,
    `/invoices/${encodeURIComponent(invoiceId)}/finalize`,
    {},
    InvoiceSchema,
    idempotencyKey,
  );
}

/** Create an inline Price (with a product name) — the building block for a payment link. */
export function createPrice(
  ctx: StripeCallContext,
  params: { amount: number; currency: string; productName: string },
  idempotencyKey: string,
): Promise<StripeApiResult<{ id: string }>> {
  return stripePost(
    ctx,
    "/prices",
    {
      unit_amount: params.amount,
      currency: params.currency,
      "product_data[name]": params.productName,
    },
    PriceSchema,
    idempotencyKey,
  );
}

/** Create a payment link for a single Price + quantity. */
export function createPaymentLink(
  ctx: StripeCallContext,
  params: { priceId: string; quantity: number },
  idempotencyKey: string,
): Promise<StripeApiResult<StripePaymentLink>> {
  return stripePost(
    ctx,
    "/payment_links",
    {
      "line_items[0][price]": params.priceId,
      "line_items[0][quantity]": params.quantity,
    },
    PaymentLinkSchema,
    idempotencyKey,
  );
}

/** Refund a charge (full or partial). The single highest-risk action in the connector set. */
export function createRefund(
  ctx: StripeCallContext,
  params: { charge: string; amount?: number },
  idempotencyKey: string,
): Promise<StripeApiResult<StripeRefund>> {
  const body: Record<string, string | number> = { charge: params.charge };
  if (params.amount !== undefined) body.amount = params.amount;
  return stripePost(ctx, "/refunds", body, RefundSchema, idempotencyKey);
}
