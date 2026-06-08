// connector.quickbooks.list_customers — read customers from the connected company.
//
// Read-only: bypasses the approval Inbox (task item 5), auto-approve eligible from day one. The
// orchestrator runtime calls this directly, and the /api/connections/quickbooks/read endpoint
// surfaces it to the app. Schema + dry-run are pure; only execute() touches the QBO API.

import { z } from "zod";
import { queryCustomers, type QuickBooksCustomer } from "../api";
import type { QuickBooksResult } from "../types";

const DEFAULT_MAX_RESULTS = 50;

export const ListCustomersInputSchema = z.object({
  // Optional case-insensitive name filter (matched on DisplayName). Empty → all active customers.
  name_contains: z.string().min(1).max(200).optional(),
  max_results: z.number().int().min(1).max(1000).optional(),
});
export type ListCustomersInput = z.infer<typeof ListCustomersInputSchema>;

// Escape a value for safe interpolation into a QBO query string literal (single quotes doubled).
function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildQuery(input: ListCustomersInput): string {
  const max = input.max_results ?? DEFAULT_MAX_RESULTS;
  const where = input.name_contains
    ? ` WHERE DisplayName LIKE ${quote(`%${input.name_contains}%`)}`
    : "";
  return `SELECT * FROM Customer${where} ORDERBY DisplayName MAXRESULTS ${max}`;
}

export function dryRunSummary(input: ListCustomersInput): string {
  const max = input.max_results ?? DEFAULT_MAX_RESULTS;
  return input.name_contains
    ? `List up to ${max} customers matching "${input.name_contains}".`
    : `List up to ${max} active customers.`;
}

export type ListCustomersAuditFields = {
  connector: "quickbooks";
  action: "list_customers";
  nameContains: string | null;
  maxResults: number;
};

export function auditFields(input: ListCustomersInput): ListCustomersAuditFields {
  return {
    connector: "quickbooks",
    action: "list_customers",
    nameContains: input.name_contains ?? null,
    maxResults: input.max_results ?? DEFAULT_MAX_RESULTS,
  };
}

// Slim, UI-safe projection of a customer.
export type ListedCustomer = {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  balance: number | null;
};

function project(c: QuickBooksCustomer): ListedCustomer {
  return {
    id: c.Id,
    name: c.DisplayName ?? c.CompanyName ?? "(unnamed)",
    companyName: c.CompanyName ?? null,
    email: c.PrimaryEmailAddr?.Address ?? null,
    balance: c.Balance ?? null,
  };
}

export async function execute(args: {
  accessToken: string;
  realmId: string;
  input: ListCustomersInput;
}): Promise<QuickBooksResult<{ customers: ListedCustomer[] }>> {
  const result = await queryCustomers(args.accessToken, args.realmId, buildQuery(args.input));
  if (!result.ok) return result;
  return { ok: true, data: { customers: result.data.map(project) } };
}

export const listCustomersAction = {
  name: "quickbooks.list_customers",
  connector: "quickbooks",
  action: "list_customers",
  gate: "read",
  description:
    "Read customers from the connected QuickBooks company, optionally filtered by name. " +
    "Read-only — never writes, so it runs without approval.",
  inputSchema: ListCustomersInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
