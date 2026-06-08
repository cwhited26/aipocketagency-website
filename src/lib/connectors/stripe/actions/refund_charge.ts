// connector.stripe.refund_charge — refund a charge (full or partial).
//
// ⚠ HIGHEST-RISK ACTION IN THE ENTIRE CONNECTOR SET (roadmap §2.4, abuse-risk 5). A refund moves
// real money OUT of the owner's account and is the prime prompt-injection target ("make PA refund
// to an attacker"). It is therefore gated as "always_gated": it is NEVER auto-approve eligible,
// regardless of how many prior refunds the owner approved — there is no trust window that ever
// unlocks it. Every single refund is an explicit, individual owner tap. The index enforces this
// invariant (isStripeAutoApproveEligibleByDefault is hard-false for refund_charge); the unit test
// pins it so a future edit can't silently relax it.
//
// Amount is entered in MAJOR units (omit for a full refund). The drafter must resolve the charge
// from a real read first and surface its date/amount/customer on the card — it must refuse to
// draft a refund whose charge_id it can't resolve (no refunds to free-typed ids).

import { z } from "zod";
import { createRefund, type StripeApiResult, type StripeCallContext } from "../api";
import { formatAmount, toMinorUnits } from "../format";

export const RefundChargeInputSchema = z.object({
  charge_id: z.string().min(1, "charge_id is required"), // ch_… or py_…
  // Omit for a full refund; provide major units for a partial refund.
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(), // only used to render/convert a partial amount
});
export type RefundChargeInput = z.infer<typeof RefundChargeInputSchema>;

export function dryRunSummary(input: RefundChargeInput): string {
  if (input.amount === undefined) {
    return `Refund the FULL amount of charge ${input.charge_id} back to the customer. This moves money out of your account.`;
  }
  const currency = (input.currency ?? "usd").toLowerCase();
  const display = formatAmount(toMinorUnits(input.amount, currency) ?? 0, currency);
  return `Refund ${display} of charge ${input.charge_id} back to the customer. This moves money out of your account.`;
}

export async function execute(args: {
  ctx: StripeCallContext;
  input: RefundChargeInput;
  idempotencyKey: string;
}): Promise<StripeApiResult<{ summary: string; data: Record<string, unknown> }>> {
  let amountMinor: number | undefined;
  if (args.input.amount !== undefined) {
    const currency = (args.input.currency ?? "usd").toLowerCase();
    const minor = toMinorUnits(args.input.amount, currency);
    if (minor === null || minor <= 0) {
      return { ok: false, status: 422, error: "Invalid refund amount.", authError: false };
    }
    amountMinor = minor;
  }

  const r = await createRefund(
    args.ctx,
    { charge: args.input.charge_id, amount: amountMinor },
    args.idempotencyKey,
  );
  if (!r.ok) return r;

  return {
    ok: true,
    data: {
      summary: `Refunded ${formatAmount(r.data.amount, r.data.currency)} of charge ${args.input.charge_id} (${r.data.status ?? "pending"}).`,
      data: { refundId: r.data.id, status: r.data.status ?? null, amount: r.data.amount, currency: r.data.currency },
    },
  };
}

export const refundChargeAction = {
  name: "stripe.refund_charge",
  connector: "stripe",
  action: "refund_charge",
  gate: "always_gated",
  description:
    "Refund a Stripe charge (full or partial). ALWAYS requires explicit owner approval — never " +
    "auto-approved, no exceptions. Refunds move real money out of your account.",
  inputSchema: RefundChargeInputSchema,
  dryRunSummary,
  execute,
} as const;
