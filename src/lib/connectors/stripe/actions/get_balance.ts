// connector.stripe.get_balance — read the connected account's Stripe balance.
//
// Read action — auto-approve eligible, bypasses the approval Inbox (roadmap §2.4). Returns the
// available + pending balance per currency. Pure schema + dry-run; only execute() touches the
// Stripe API.

import { z } from "zod";
import { getBalance, type StripeApiResult, type StripeCallContext } from "../api";
import { formatAmount } from "../format";

// No inputs — the balance is account-wide. An empty object keeps the uniform action shape.
export const GetBalanceInputSchema = z.object({}).strict();
export type GetBalanceInput = z.infer<typeof GetBalanceInputSchema>;

export function dryRunSummary(_input: GetBalanceInput): string {
  return "Read your Stripe available + pending balance.";
}

export async function execute(args: {
  ctx: StripeCallContext;
  input: GetBalanceInput;
}): Promise<StripeApiResult<{ summary: string; data: Record<string, unknown> }>> {
  const r = await getBalance(args.ctx);
  if (!r.ok) return r;
  const available = r.data.available.map((b) => ({
    currency: b.currency,
    amount: b.amount,
    display: formatAmount(b.amount, b.currency),
  }));
  const pending = r.data.pending.map((b) => ({
    currency: b.currency,
    amount: b.amount,
    display: formatAmount(b.amount, b.currency),
  }));
  const headline =
    available.length > 0 ? available.map((b) => b.display).join(", ") : "no available balance";
  return {
    ok: true,
    data: { summary: `Available: ${headline}.`, data: { available, pending } },
  };
}

export const getBalanceAction = {
  name: "stripe.get_balance",
  connector: "stripe",
  action: "get_balance",
  gate: "read",
  description: "Read the connected Stripe account's available and pending balance (read-only).",
  inputSchema: GetBalanceInputSchema,
  dryRunSummary,
  execute,
} as const;
