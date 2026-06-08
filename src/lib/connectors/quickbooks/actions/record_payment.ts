// connector.quickbooks.record_payment — record a payment against an invoice.
//
// Write action — the STRICTEST gate in the connector (task item 5): recording a payment moves
// real money on the books, so it stages per-action approval every time, earns auto-approve
// eligibility only after a hard-tightened N=20 trust window, and even past that stays opt-in /
// default-off (the owner must deliberately flip it on; it never auto-fires by default). A wrong
// amount or a misapplied payment is real accounting cleanup, so the dry-run renders the exact
// dollar amount, the target invoice, and the customer before anything is staged. Idempotency is
// enforced via the Request-Id header in api.ts.
//
// Schema, dry-run, and request-body builder are pure; only execute() touches the QBO API.

import { z } from "zod";
import { createPayment, type PaymentWriteBody } from "../api";
import { formatMoney } from "../format";
import type { QuickBooksResult } from "../types";

export const RecordPaymentInputSchema = z.object({
  // The QBO Invoice id the payment is applied to (LinkedTxn.TxnId).
  invoice_id: z.string().min(1, "invoice_id is required").max(100),
  // The QBO Customer id (CustomerRef.value) — required by the Payment resource.
  customer_ref: z.string().min(1, "customer_ref is required").max(100),
  amount: z.number().positive("payment amount must be greater than zero"),
  // Display label for the card + audit (e.g. "check", "ACH"). Informational — QBO's
  // PaymentMethodRef needs an id we don't resolve here, so this is not sent to the API.
  method: z.string().min(1).max(60).optional(),
  // Display name for the approval card only.
  customer_name: z.string().min(1).max(300).optional(),
});
export type RecordPaymentInput = z.infer<typeof RecordPaymentInputSchema>;

export function buildPaymentBody(input: RecordPaymentInput): PaymentWriteBody {
  return {
    TotalAmt: input.amount,
    CustomerRef: { value: input.customer_ref },
    Line: [
      {
        Amount: input.amount,
        LinkedTxn: [{ TxnId: input.invoice_id, TxnType: "Invoice" }],
      },
    ],
  };
}

export function dryRunSummary(input: RecordPaymentInput): string {
  const lines: string[] = [];
  lines.push(
    `Record a ${formatMoney(input.amount)} payment from ` +
      `${input.customer_name ?? `customer ${input.customer_ref}`}`,
  );
  lines.push(`Applied to invoice ${input.invoice_id}${input.method ? ` · ${input.method}` : ""}`);
  lines.push("", "This records real money received in QuickBooks once you approve.");
  return lines.join("\n");
}

export type RecordPaymentAuditFields = {
  connector: "quickbooks";
  action: "record_payment";
  invoiceId: string;
  customerRef: string;
  amount: number;
  method: string | null;
};

export function auditFields(input: RecordPaymentInput): RecordPaymentAuditFields {
  return {
    connector: "quickbooks",
    action: "record_payment",
    invoiceId: input.invoice_id,
    customerRef: input.customer_ref,
    amount: input.amount,
    method: input.method ?? null,
  };
}

export async function execute(args: {
  accessToken: string;
  realmId: string;
  input: RecordPaymentInput;
  requestId: string;
}): Promise<QuickBooksResult<{ paymentId: string; amount: number | null }>> {
  const result = await createPayment(
    args.accessToken,
    args.realmId,
    buildPaymentBody(args.input),
    args.requestId,
  );
  if (!result.ok) return result;
  return { ok: true, data: { paymentId: result.data.id, amount: result.data.totalAmt } };
}

export const recordPaymentAction = {
  name: "quickbooks.record_payment",
  connector: "quickbooks",
  action: "record_payment",
  gate: "gated",
  description:
    "Record a payment against an invoice in the connected QuickBooks company. The strictest " +
    "gate: stages per-action approval every time, earns auto-approve eligibility only after 20 " +
    "manual approvals, and even then stays opt-in (default-off).",
  inputSchema: RecordPaymentInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
