// connector.quickbooks.create_invoice — create an invoice in the connected company.
//
// Write action — approval-gated (task items 5–6). The high-value action: a sub-agent stages it
// in the Inbox with the FULL dollar amount + customer + line items rendered, and it fires only
// after the owner approves. It earns auto-approve eligibility only after clearing the tightened
// trust window (N=10 manual approvals; even then a per-customer auto-approve shows a confirm
// toast — never blanket). Idempotency is enforced via the Request-Id header in api.ts.
//
// MIME-free: the schema, dry-run, and request-body builder are pure (no network/DB); only
// execute() touches the QBO API.

import { z } from "zod";
import { createInvoice, type InvoiceWriteBody, type InvoiceLineBody } from "../api";
import { formatMoney, lineItemsTotal } from "../format";
import type { QuickBooksResult } from "../types";

export const InvoiceLineInputSchema = z.object({
  description: z.string().min(1, "each line needs a description").max(4_000),
  amount: z.number().positive("line amount must be greater than zero"),
  // Optional QBO Item id; when absent QBO applies the company's default item server-side.
  item_ref: z.string().min(1).max(100).optional(),
  quantity: z.number().positive().optional(),
  unit_price: z.number().positive().optional(),
});
export type InvoiceLineInput = z.infer<typeof InvoiceLineInputSchema>;

export const CreateInvoiceInputSchema = z.object({
  // The QBO Customer id (CustomerRef.value). The drafter resolves a name → id before staging.
  customer_ref: z.string().min(1, "customer_ref is required").max(100),
  // Display name for the approval card only (never sent to the API).
  customer_name: z.string().min(1).max(300).optional(),
  line_items: z.array(InvoiceLineInputSchema).min(1, "at least one line item is required").max(100),
  // YYYY-MM-DD. The drafter defaults this to net-30 from the source context.
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "due_date must be YYYY-MM-DD").optional(),
  memo: z.string().max(1_000).optional(),
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

export function buildInvoiceBody(input: CreateInvoiceInput): InvoiceWriteBody {
  const Line: InvoiceLineBody[] = input.line_items.map((li) => {
    const detail: InvoiceLineBody["SalesItemLineDetail"] = {};
    if (li.item_ref) detail.ItemRef = { value: li.item_ref };
    if (li.quantity !== undefined) detail.Qty = li.quantity;
    if (li.unit_price !== undefined) detail.UnitPrice = li.unit_price;
    return {
      Amount: li.amount,
      DetailType: "SalesItemLineDetail",
      Description: li.description,
      SalesItemLineDetail: detail,
    };
  });
  const body: InvoiceWriteBody = {
    CustomerRef: { value: input.customer_ref },
    Line,
  };
  if (input.due_date) body.DueDate = input.due_date;
  if (input.memo) body.CustomerMemo = { value: input.memo };
  return body;
}

export function dryRunSummary(input: CreateInvoiceInput): string {
  const total = lineItemsTotal(input.line_items);
  const lines: string[] = [];
  lines.push(`Create invoice for ${input.customer_name ?? `customer ${input.customer_ref}`}`);
  lines.push(`Total: ${formatMoney(total)}${input.due_date ? ` · due ${input.due_date}` : ""}`);
  lines.push("");
  for (const li of input.line_items) {
    lines.push(`• ${li.description} — ${formatMoney(li.amount)}`);
  }
  if (input.memo) {
    const flat = input.memo.replace(/\s+/g, " ").trim();
    lines.push("", flat.length > 280 ? `${flat.slice(0, 280).trimEnd()}…` : flat);
  }
  lines.push("", "This creates a real invoice in QuickBooks once you approve.");
  return lines.join("\n");
}

export type CreateInvoiceAuditFields = {
  connector: "quickbooks";
  action: "create_invoice";
  customerRef: string;
  lineCount: number;
  total: number;
  dueDate: string | null;
};

export function auditFields(input: CreateInvoiceInput): CreateInvoiceAuditFields {
  return {
    connector: "quickbooks",
    action: "create_invoice",
    customerRef: input.customer_ref,
    lineCount: input.line_items.length,
    total: lineItemsTotal(input.line_items),
    dueDate: input.due_date ?? null,
  };
}

export async function execute(args: {
  accessToken: string;
  realmId: string;
  input: CreateInvoiceInput;
  requestId: string;
}): Promise<QuickBooksResult<{ invoiceId: string; docNumber: string | null; total: number | null }>> {
  const result = await createInvoice(
    args.accessToken,
    args.realmId,
    buildInvoiceBody(args.input),
    args.requestId,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: { invoiceId: result.data.id, docNumber: result.data.docNumber, total: result.data.totalAmt },
  };
}

export const createInvoiceAction = {
  name: "quickbooks.create_invoice",
  connector: "quickbooks",
  action: "create_invoice",
  gate: "gated",
  description:
    "Create an invoice in the connected QuickBooks company. Approval-gated: stages in the Inbox " +
    "with the full amount + line items; the invoice is created only on approval. Earns auto-" +
    "approve eligibility only after 10 manual approvals.",
  inputSchema: CreateInvoiceInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
