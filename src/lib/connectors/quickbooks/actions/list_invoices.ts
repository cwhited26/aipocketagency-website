// connector.quickbooks.list_invoices — read invoices from the connected company.
//
// Read-only: bypasses the approval Inbox (task item 5), auto-approve eligible from day one.
// Optional filters: a specific customer, and "unpaid only" (Balance > 0). Schema + dry-run are
// pure; only execute() touches the QBO API.

import { z } from "zod";
import { queryInvoices, type QuickBooksInvoice } from "../api";
import type { QuickBooksResult } from "../types";

const DEFAULT_MAX_RESULTS = 50;

export const ListInvoicesInputSchema = z.object({
  customer_ref: z.string().min(1).max(100).optional(),
  unpaid_only: z.boolean().optional(),
  max_results: z.number().int().min(1).max(1000).optional(),
});
export type ListInvoicesInput = z.infer<typeof ListInvoicesInputSchema>;

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildQuery(input: ListInvoicesInput): string {
  const max = input.max_results ?? DEFAULT_MAX_RESULTS;
  const clauses: string[] = [];
  if (input.customer_ref) clauses.push(`CustomerRef = ${quote(input.customer_ref)}`);
  if (input.unpaid_only) clauses.push("Balance > '0'");
  const where = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
  return `SELECT * FROM Invoice${where} ORDERBY TxnDate DESC MAXRESULTS ${max}`;
}

export function dryRunSummary(input: ListInvoicesInput): string {
  const max = input.max_results ?? DEFAULT_MAX_RESULTS;
  const scope = input.unpaid_only ? "unpaid invoices" : "invoices";
  const who = input.customer_ref ? ` for customer ${input.customer_ref}` : "";
  return `List up to ${max} ${scope}${who}, newest first.`;
}

export type ListInvoicesAuditFields = {
  connector: "quickbooks";
  action: "list_invoices";
  customerRef: string | null;
  unpaidOnly: boolean;
  maxResults: number;
};

export function auditFields(input: ListInvoicesInput): ListInvoicesAuditFields {
  return {
    connector: "quickbooks",
    action: "list_invoices",
    customerRef: input.customer_ref ?? null,
    unpaidOnly: Boolean(input.unpaid_only),
    maxResults: input.max_results ?? DEFAULT_MAX_RESULTS,
  };
}

// Slim, UI-safe projection of an invoice.
export type ListedInvoice = {
  id: string;
  docNumber: string | null;
  customer: string | null;
  txnDate: string | null;
  dueDate: string | null;
  total: number | null;
  balance: number | null;
};

function project(i: QuickBooksInvoice): ListedInvoice {
  return {
    id: i.Id,
    docNumber: i.DocNumber ?? null,
    customer: i.CustomerRef?.name ?? i.CustomerRef?.value ?? null,
    txnDate: i.TxnDate ?? null,
    dueDate: i.DueDate ?? null,
    total: i.TotalAmt ?? null,
    balance: i.Balance ?? null,
  };
}

export async function execute(args: {
  accessToken: string;
  realmId: string;
  input: ListInvoicesInput;
}): Promise<QuickBooksResult<{ invoices: ListedInvoice[] }>> {
  const result = await queryInvoices(args.accessToken, args.realmId, buildQuery(args.input));
  if (!result.ok) return result;
  return { ok: true, data: { invoices: result.data.map(project) } };
}

export const listInvoicesAction = {
  name: "quickbooks.list_invoices",
  connector: "quickbooks",
  action: "list_invoices",
  gate: "read",
  description:
    "Read invoices from the connected QuickBooks company, optionally filtered to one customer " +
    "or to unpaid invoices. Read-only — never writes, so it runs without approval.",
  inputSchema: ListInvoicesInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
