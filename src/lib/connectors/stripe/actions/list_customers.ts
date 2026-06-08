// connector.stripe.list_customers — read the connected account's customers.
//
// Read action — auto-approve eligible, bypasses the approval Inbox (roadmap §2.4). Pure schema +
// dry-run; only execute() touches the Stripe API. Used by the drafter to resolve a customer id
// from a name before staging an invoice/payment-link, and by the read endpoint directly.

import { z } from "zod";
import { listCustomers, type StripeApiResult, type StripeCallContext } from "../api";

export const ListCustomersInputSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});
export type ListCustomersInput = z.infer<typeof ListCustomersInputSchema>;

export function dryRunSummary(input: ListCustomersInput): string {
  return `List up to ${input.limit ?? 20} customers from your Stripe account.`;
}

export async function execute(args: {
  ctx: StripeCallContext;
  input: ListCustomersInput;
}): Promise<StripeApiResult<{ summary: string; data: Record<string, unknown> }>> {
  const r = await listCustomers(args.ctx, args.input.limit ?? 20);
  if (!r.ok) return r;
  const customers = r.data.data.map((c) => ({
    id: c.id,
    name: c.name ?? null,
    email: c.email ?? null,
  }));
  return {
    ok: true,
    data: {
      summary: `Found ${customers.length} customer(s).`,
      data: { customers, hasMore: r.data.has_more ?? false },
    },
  };
}

export const listCustomersAction = {
  name: "stripe.list_customers",
  connector: "stripe",
  action: "list_customers",
  gate: "read",
  description: "List customers in the connected Stripe account (read-only).",
  inputSchema: ListCustomersInputSchema,
  dryRunSummary,
  execute,
} as const;
