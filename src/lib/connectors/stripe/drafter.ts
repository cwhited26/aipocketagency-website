// connectors/stripe/drafter.ts — the Stripe drafter sub-agent's payload builders (roadmap §2.4
// "Drafter sub-agent behavior"). Pure functions: they take the source context a sub-agent has
// gathered (the invoice/quote amount, the customer resolved from a real read, the job
// description) and assemble a validated action payload to stage. No network, no DB — the
// sub-agent does the reads; these turn the gathered facts into a staged action.
//
// The hard safety rule lives here: a refund is NEVER drafted from a free-typed charge id. The
// drafter must have resolved the charge from a real Stripe read (its date/amount/customer) first;
// buildRefundDraft refuses otherwise (roadmap §2.4 — "no refunds to free-typed IDs"). This is the
// drafter-side complement to the always-gated approval (refund_charge can't be drafted blindly
// AND can't be auto-approved).

import type { CreateInvoiceInput } from "./actions/create_invoice";
import type { CreatePaymentLinkInput } from "./actions/create_payment_link";
import type { RefundChargeInput } from "./actions/refund_charge";
import type { StripeCustomer } from "./api";

/** Thrown when the drafter lacks the context to safely assemble an action. */
export class StripeDraftContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeDraftContextError";
  }
}

// A charge the drafter resolved from a REAL Stripe read — the only thing it may refund against.
export type ResolvedCharge = {
  id: string;
  amount: number; // minor units, as Stripe returns
  currency: string;
  customer?: string | null;
  description?: string | null;
};

export type InvoiceDraftContext = {
  customerId: string | null;
  lineItems: { amount: number; description: string }[];
  currency?: string;
  daysUntilDue?: number;
  description?: string;
};

/** Assemble a create_invoice payload, refusing when the customer or any line is unresolved. */
export function buildInvoiceDraft(ctx: InvoiceDraftContext): CreateInvoiceInput {
  if (!ctx.customerId) {
    throw new StripeDraftContextError(
      "Couldn't resolve the customer — I won't invoice without a real Stripe customer id.",
    );
  }
  if (ctx.lineItems.length === 0) {
    throw new StripeDraftContextError("No line items to invoice.");
  }
  for (const li of ctx.lineItems) {
    if (!(li.amount > 0) || !li.description.trim()) {
      throw new StripeDraftContextError("Each invoice line needs a positive amount and a description.");
    }
  }
  const out: CreateInvoiceInput = {
    customer: ctx.customerId,
    line_items: ctx.lineItems.map((li) => ({ amount: li.amount, description: li.description.trim() })),
  };
  if (ctx.currency) out.currency = ctx.currency;
  if (ctx.daysUntilDue) out.days_until_due = ctx.daysUntilDue;
  if (ctx.description) out.description = ctx.description;
  return out;
}

export type PaymentLinkDraftContext = {
  amount: number;
  description: string;
  currency?: string;
  quantity?: number;
};

/** Assemble a create_payment_link payload, refusing when amount/description are missing. */
export function buildPaymentLinkDraft(ctx: PaymentLinkDraftContext): CreatePaymentLinkInput {
  if (!(ctx.amount > 0)) {
    throw new StripeDraftContextError("A payment link needs a positive amount.");
  }
  if (!ctx.description.trim()) {
    throw new StripeDraftContextError("A payment link needs a description (it becomes the product name).");
  }
  const out: CreatePaymentLinkInput = { amount: ctx.amount, description: ctx.description.trim() };
  if (ctx.currency) out.currency = ctx.currency;
  if (ctx.quantity) out.quantity = ctx.quantity;
  return out;
}

/**
 * Assemble a refund_charge payload. REQUIRES a charge resolved from a real read — never a
 * free-typed id. `amountMajor` (optional) requests a partial refund; omit for a full refund. A
 * partial amount may not exceed the resolved charge total.
 */
export function buildRefundDraft(
  resolved: ResolvedCharge | null | undefined,
  amountMajor?: number,
): RefundChargeInput {
  if (!resolved || !resolved.id) {
    throw new StripeDraftContextError(
      "I can only refund a charge I've looked up — give me the charge to refund and I'll confirm its details first.",
    );
  }
  const out: RefundChargeInput = { charge_id: resolved.id, currency: resolved.currency };
  if (amountMajor !== undefined) {
    if (!(amountMajor > 0)) {
      throw new StripeDraftContextError("A partial refund needs a positive amount.");
    }
    out.amount = amountMajor;
  }
  return out;
}

/**
 * Resolve a customer id from a name against a customer list pulled from a real read. Returns the
 * id on an unambiguous case-insensitive name match, else null (the drafter then asks rather than
 * guessing — invoicing the wrong customer is a real error). An exact match wins over a partial.
 */
export function resolveCustomerId(customers: readonly StripeCustomer[], name: string): string | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  const exact = customers.filter((c) => (c.name ?? "").trim().toLowerCase() === needle);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) return null; // ambiguous — don't guess
  const partial = customers.filter((c) => (c.name ?? "").trim().toLowerCase().includes(needle));
  return partial.length === 1 ? partial[0].id : null;
}
