// connector.stripe.create_payment_link — a reusable hosted checkout link for a fixed amount.
//
// Write action — approval-gated (roadmap §2.4). The safest money action: it creates nothing that
// moves money on its own — the customer must still choose to pay. May graduate to auto-approve
// after the PA-ORCH-4 trust window (N=10).
//
// Stripe payment links require a Price, not a raw amount, so the flow is two steps: create an
// inline Price (with a product name) → create the payment link for that Price. Amount is entered
// in MAJOR units and converted to minor units. Each sub-request carries a derived idempotency
// key so a retry never creates duplicate prices/links.

import { z } from "zod";
import {
  createPaymentLink,
  createPrice,
  type StripeApiResult,
  type StripeCallContext,
} from "../api";
import { formatAmount, toMinorUnits } from "../format";

export const CreatePaymentLinkInputSchema = z.object({
  amount: z.number().positive(), // major units, e.g. 500 = $500.00
  currency: z.string().length(3).optional(),
  description: z.string().min(1, "description is required").max(250), // becomes the product name
  quantity: z.number().int().positive().max(999).optional(),
});
export type CreatePaymentLinkInput = z.infer<typeof CreatePaymentLinkInputSchema>;

function currencyOf(input: CreatePaymentLinkInput): string {
  return (input.currency ?? "usd").toLowerCase();
}

export function dryRunSummary(input: CreatePaymentLinkInput): string {
  const currency = currencyOf(input);
  const qty = input.quantity ?? 1;
  const unit = formatAmount(toMinorUnits(input.amount, currency) ?? 0, currency);
  const totalNote = qty > 1 ? ` × ${qty}` : "";
  return (
    `Create a payment link: "${input.description}" for ${unit}${totalNote}. ` +
    "Anyone with the link can pay; nothing is charged until they do."
  );
}

export async function execute(args: {
  ctx: StripeCallContext;
  input: CreatePaymentLinkInput;
  idempotencyKey: string;
}): Promise<StripeApiResult<{ summary: string; data: Record<string, unknown> }>> {
  const currency = currencyOf(args.input);
  const minor = toMinorUnits(args.input.amount, currency);
  if (minor === null || minor <= 0) {
    return { ok: false, status: 422, error: "Invalid amount.", authError: false };
  }

  const price = await createPrice(
    args.ctx,
    { amount: minor, currency, productName: args.input.description },
    `${args.idempotencyKey}:price`,
  );
  if (!price.ok) return price;

  const link = await createPaymentLink(
    args.ctx,
    { priceId: price.data.id, quantity: args.input.quantity ?? 1 },
    `${args.idempotencyKey}:link`,
  );
  if (!link.ok) return link;

  return {
    ok: true,
    data: {
      summary: `Payment link for ${formatAmount(minor, currency)} created.`,
      data: { paymentLinkId: link.data.id, url: link.data.url },
    },
  };
}

export const createPaymentLinkAction = {
  name: "stripe.create_payment_link",
  connector: "stripe",
  action: "create_payment_link",
  gate: "gated",
  description:
    "Create a reusable Stripe payment link for a fixed amount. Approval-gated: stages in the " +
    "Inbox first; the link is created only on approval. The customer must still choose to pay.",
  inputSchema: CreatePaymentLinkInputSchema,
  dryRunSummary,
  execute,
} as const;
