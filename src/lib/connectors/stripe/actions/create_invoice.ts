// connector.stripe.create_invoice — draft + finalize an invoice for a customer.
//
// Write action — approval-gated with a STRICT trust window (roadmap §2.4): a sub-agent stages it
// in the Inbox; it fires only after the owner approves, and the dry-run shows the exact total so
// approval is informed. It may graduate to auto-approve after the PA-ORCH-4 trust window
// (N=10) — but only ever for create_invoice, never for refund_charge.
//
// Money in, money out: amounts are entered in MAJOR units (e.g. 150 = $150.00) and converted to
// the integer minor units Stripe wants. The flow is the standard Stripe three-step: one
// invoiceitem per line → a send_invoice invoice that sweeps them up → finalize so it gets a
// number + hosted payment page. Each sub-request carries a derived idempotency key so a retry
// never double-bills.

import { z } from "zod";
import {
  createInvoice,
  createInvoiceItem,
  finalizeInvoice,
  type StripeApiResult,
  type StripeCallContext,
} from "../api";
import { formatAmount, toMinorUnits } from "../format";

const LineItemSchema = z.object({
  amount: z.number().positive(), // major units, e.g. 150 = $150.00
  description: z.string().min(1).max(500),
});

export const CreateInvoiceInputSchema = z.object({
  customer: z.string().min(1, "customer is required"), // Stripe customer id (cus_…)
  currency: z.string().length(3).optional(),
  line_items: z.array(LineItemSchema).min(1, "at least one line item is required").max(50),
  days_until_due: z.number().int().positive().max(365).optional(),
  description: z.string().max(500).optional(),
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

function currencyOf(input: CreateInvoiceInput): string {
  return (input.currency ?? "usd").toLowerCase();
}

function totalMajor(input: CreateInvoiceInput): number {
  return input.line_items.reduce((sum, li) => sum + li.amount, 0);
}

export function dryRunSummary(input: CreateInvoiceInput): string {
  const currency = currencyOf(input);
  const lines: string[] = [];
  lines.push(`Create + finalize an invoice for customer ${input.customer}`);
  for (const li of input.line_items) {
    lines.push(`  • ${li.description} — ${formatAmount(toMinorUnits(li.amount, currency) ?? 0, currency)}`);
  }
  lines.push(`Total: ${formatAmount(toMinorUnits(totalMajor(input), currency) ?? 0, currency)}`);
  lines.push(`Due in ${input.days_until_due ?? 30} days. The customer is emailed a payment link.`);
  return lines.join("\n");
}

export async function execute(args: {
  ctx: StripeCallContext;
  input: CreateInvoiceInput;
  idempotencyKey: string;
}): Promise<StripeApiResult<{ summary: string; data: Record<string, unknown> }>> {
  const currency = currencyOf(args.input);

  // 1. One invoice item per line. A bad amount is rejected before anything is created.
  for (let i = 0; i < args.input.line_items.length; i++) {
    const li = args.input.line_items[i];
    const minor = toMinorUnits(li.amount, currency);
    if (minor === null || minor <= 0) {
      return { ok: false, status: 422, error: `Invalid amount on line ${i + 1}.`, authError: false };
    }
    const item = await createInvoiceItem(
      args.ctx,
      { customer: args.input.customer, amount: minor, currency, description: li.description },
      `${args.idempotencyKey}:item:${i}`,
    );
    if (!item.ok) return item;
  }

  // 2. Invoice that sweeps up the pending items.
  const invoice = await createInvoice(
    args.ctx,
    {
      customer: args.input.customer,
      daysUntilDue: args.input.days_until_due,
      description: args.input.description,
    },
    `${args.idempotencyKey}:invoice`,
  );
  if (!invoice.ok) return invoice;

  // 3. Finalize so it gets a number + hosted payment page.
  const finalized = await finalizeInvoice(args.ctx, invoice.data.id, `${args.idempotencyKey}:finalize`);
  if (!finalized.ok) return finalized;

  const total = formatAmount(toMinorUnits(totalMajor(args.input), currency) ?? 0, currency);
  return {
    ok: true,
    data: {
      summary: `Invoice ${finalized.data.number ?? finalized.data.id} for ${total} created.`,
      data: {
        invoiceId: finalized.data.id,
        number: finalized.data.number ?? null,
        status: finalized.data.status ?? null,
        hostedInvoiceUrl: finalized.data.hosted_invoice_url ?? null,
      },
    },
  };
}

export const createInvoiceAction = {
  name: "stripe.create_invoice",
  connector: "stripe",
  action: "create_invoice",
  gate: "gated",
  description:
    "Create + finalize a Stripe invoice for a customer and email them a payment link. " +
    "Approval-gated: stages in the Inbox first; the invoice sends only on approval.",
  inputSchema: CreateInvoiceInputSchema,
  dryRunSummary,
  execute,
} as const;
