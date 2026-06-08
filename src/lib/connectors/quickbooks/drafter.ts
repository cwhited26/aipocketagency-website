// connectors/quickbooks/drafter.ts — drafter sub-agent behavior for QuickBooks (roadmap §2.3).
//
// When PA drafts an invoice from a job/thread the owner is acting on, the customer + line items
// come from the SOURCE CONTEXT (a matched brain customer + the scope-of-work in the originating
// chat), never free-typed from untrusted content. The drafter resolves a customer NAME to its
// QBO id (handed in from a prior list_customers match) and defaults the due date to net-30
// unless the context overrides it. If no customer id resolved or no line items were drafted, it
// REFUSES here with a clear, owner-facing error rather than staging an invoice to the wrong
// customer or for $0. Pure + synchronous so it's unit-tested.

import {
  CreateInvoiceInputSchema,
  type CreateInvoiceInput,
  type InvoiceLineInput,
} from "./actions/create_invoice";
import { netDueDate } from "./format";

const DEFAULT_NET_DAYS = 30;

/** A customer the drafter resolved from a prior list_customers match (id is the QBO ref). */
export type DraftCustomer = {
  ref: string;
  name?: string;
};

/** A line item drafted from the scope-of-work in the source context. */
export type DraftLineItem = {
  description: string;
  amount: number;
  itemRef?: string;
  quantity?: number;
  unitPrice?: number;
};

/** Everything the drafter pulls from the originating job/thread to compose the invoice. */
export type InvoiceDraftContext = {
  customer: DraftCustomer | null;
  lineItems: DraftLineItem[];
  // `YYYY-MM-DD` base the net-30 default is computed from (the invoice/txn date). Required so the
  // due date stays deterministic — the drafter never reaches for Date.now() itself.
  invoiceDate: string;
  // Owner memory override for payment terms ("net 15", etc.); falls back to net-30.
  netDays?: number;
  // Explicit due date from context wins over the net-N default.
  dueDate?: string;
  memo?: string;
};

export class InvoiceDraftContextError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string) {
    super(`InvoiceDraftContext: ${userMessage}`);
    this.name = "InvoiceDraftContextError";
    this.userMessage = userMessage;
  }
}

export type InvoiceDraft = {
  action: "create_invoice";
  payload: CreateInvoiceInput;
};

/**
 * Build a validated create_invoice payload from the source context. Throws
 * InvoiceDraftContextError (clear, owner-facing) when the customer didn't resolve or no line
 * items were drafted — the "refuse rather than guess" requirement. The caller stages the
 * returned payload through the approval middleware exactly like any other write.
 */
export function buildInvoiceDraft(context: InvoiceDraftContext): InvoiceDraft {
  if (!context.customer?.ref) {
    throw new InvoiceDraftContextError(
      "I can't draft this invoice — I couldn't match it to a QuickBooks customer. Tell me which " +
        "customer it's for and I'll set it up.",
    );
  }
  if (context.lineItems.length === 0) {
    throw new InvoiceDraftContextError(
      "I can't draft this invoice — there's nothing to bill for yet. Give me the line items " +
        "(what was done and the amounts) and I'll put it together.",
    );
  }

  const line_items: InvoiceLineInput[] = context.lineItems.map((li) => {
    const item: InvoiceLineInput = { description: li.description, amount: li.amount };
    if (li.itemRef) item.item_ref = li.itemRef;
    if (li.quantity !== undefined) item.quantity = li.quantity;
    if (li.unitPrice !== undefined) item.unit_price = li.unitPrice;
    return item;
  });

  const dueDate =
    context.dueDate ?? netDueDate(context.invoiceDate, context.netDays ?? DEFAULT_NET_DAYS);

  const draft: CreateInvoiceInput = {
    customer_ref: context.customer.ref,
    line_items: line_items,
    due_date: dueDate,
  };
  if (context.customer.name) draft.customer_name = context.customer.name;
  if (context.memo) draft.memo = context.memo;

  // Validate the composed payload up-front so a malformed draft fails at draft time (with the
  // schema's message) rather than at stage/execute time.
  const parsed = CreateInvoiceInputSchema.safeParse(draft);
  if (!parsed.success) {
    throw new InvoiceDraftContextError(
      parsed.error.issues[0]?.message ?? "The drafted invoice was invalid.",
    );
  }
  return { action: "create_invoice", payload: parsed.data };
}
