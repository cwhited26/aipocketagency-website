// connector.quickbooks.run_pl_report — run a Profit & Loss report for a date range.
//
// Read-only: bypasses the approval Inbox (task item 5), auto-approve eligible from day one.
// Ships first in the QuickBooks lane (roadmap §2.3 — "ships run_report read-only first"). The
// report tree is flattened to its three headline numbers for the summary. Schema + dry-run are
// pure; only execute() touches the QBO API.

import { z } from "zod";
import { fetchProfitAndLoss } from "../api";
import { summarizeProfitAndLoss, type ProfitAndLossSummary } from "../format";
import type { QuickBooksResult } from "../types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const RunPlReportInputSchema = z.object({
  start_date: z.string().regex(ISO_DATE, "start_date must be YYYY-MM-DD").optional(),
  end_date: z.string().regex(ISO_DATE, "end_date must be YYYY-MM-DD").optional(),
  // QBO accounting basis; Accrual is the QBO default when omitted.
  accounting_method: z.enum(["Accrual", "Cash"]).optional(),
});
export type RunPlReportInput = z.infer<typeof RunPlReportInputSchema>;

export function dryRunSummary(input: RunPlReportInput): string {
  const range =
    input.start_date && input.end_date
      ? `${input.start_date} → ${input.end_date}`
      : input.start_date
        ? `since ${input.start_date}`
        : "the default period";
  const basis = input.accounting_method ? ` (${input.accounting_method} basis)` : "";
  return `Run a Profit & Loss report for ${range}${basis}.`;
}

export type RunPlReportAuditFields = {
  connector: "quickbooks";
  action: "run_pl_report";
  startDate: string | null;
  endDate: string | null;
  accountingMethod: string | null;
};

export function auditFields(input: RunPlReportInput): RunPlReportAuditFields {
  return {
    connector: "quickbooks",
    action: "run_pl_report",
    startDate: input.start_date ?? null,
    endDate: input.end_date ?? null,
    accountingMethod: input.accounting_method ?? null,
  };
}

export async function execute(args: {
  accessToken: string;
  realmId: string;
  input: RunPlReportInput;
}): Promise<QuickBooksResult<{ summary: ProfitAndLossSummary }>> {
  const result = await fetchProfitAndLoss(args.accessToken, args.realmId, {
    startDate: args.input.start_date,
    endDate: args.input.end_date,
    accountingMethod: args.input.accounting_method,
  });
  if (!result.ok) return result;
  return { ok: true, data: { summary: summarizeProfitAndLoss(result.data) } };
}

export const runPlReportAction = {
  name: "quickbooks.run_pl_report",
  connector: "quickbooks",
  action: "run_pl_report",
  gate: "read",
  description:
    "Run a Profit & Loss report on the connected QuickBooks company for a date range. " +
    "Read-only — never writes, so it runs without approval.",
  inputSchema: RunPlReportInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
