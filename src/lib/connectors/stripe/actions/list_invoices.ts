// connector.stripe.list_invoices — read the connected account's invoices.
//
// Read action — auto-approve eligible, bypasses the approval Inbox (roadmap §2.4). Optionally
// scoped to one customer or one status (draft / open / paid / void / uncollectible). Pure schema
// + dry-run; only execute() touches the Stripe API.

import { z } from "zod";
import { listInvoices, type StripeApiResult, type StripeCallContext } from "../api";
import { formatAmount } from "../format";

const INVOICE_STATUSES = ["draft", "open", "paid", "uncollectible", "void"] as const;

export const ListInvoicesInputSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  customer: z.string().min(1).optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
});
export type ListInvoicesInput = z.infer<typeof ListInvoicesInputSchema>;

export function dryRunSummary(input: ListInvoicesInput): string {
  const scope = input.customer ? ` for customer ${input.customer}` : "";
  const status = input.status ? ` (${input.status})` : "";
  return `List up to ${input.limit ?? 20} invoices${scope}${status} from your Stripe account.`;
}

export async function execute(args: {
  ctx: StripeCallContext;
  input: ListInvoicesInput;
}): Promise<StripeApiResult<{ summary: string; data: Record<string, unknown> }>> {
  const r = await listInvoices(args.ctx, {
    limit: args.input.limit ?? 20,
    customer: args.input.customer,
    status: args.input.status,
  });
  if (!r.ok) return r;
  const invoices = r.data.data.map((inv) => ({
    id: inv.id,
    number: inv.number ?? null,
    status: inv.status ?? null,
    amountDue:
      inv.amount_due !== undefined && inv.currency
        ? formatAmount(inv.amount_due, inv.currency)
        : null,
    customer: inv.customer ?? null,
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
  }));
  return {
    ok: true,
    data: {
      summary: `Found ${invoices.length} invoice(s).`,
      data: { invoices, hasMore: r.data.has_more ?? false },
    },
  };
}

export const listInvoicesAction = {
  name: "stripe.list_invoices",
  connector: "stripe",
  action: "list_invoices",
  gate: "read",
  description: "List invoices in the connected Stripe account, optionally by customer or status (read-only).",
  inputSchema: ListInvoicesInputSchema,
  dryRunSummary,
  execute,
} as const;
