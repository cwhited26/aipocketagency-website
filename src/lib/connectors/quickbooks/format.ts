// connectors/quickbooks/format.ts — pure formatting + projection helpers shared by the action
// dry-run summaries, the drafter, and the P&L reader. No network, no DB — unit-testable in
// isolation.

import type { ProfitAndLossReport } from "./api";

/** "$1,234.50" — plain USD money label for dry-run cards and summaries. */
export function formatMoney(amount: number): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Sum of line-item amounts — the invoice total shown on the approval card. */
export function lineItemsTotal(lines: readonly { amount: number }[]): number {
  return lines.reduce((sum, l) => sum + (Number.isFinite(l.amount) ? l.amount : 0), 0);
}

/**
 * Net-30 (or net-N) due date from an ISO/`YYYY-MM-DD` base. Pure: derives only from the passed
 * base date so it stays deterministic for tests (no Date.now() inside). Returns `YYYY-MM-DD`.
 */
export function netDueDate(baseDateIso: string, netDays: number): string {
  const base = new Date(`${baseDateIso.slice(0, 10)}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + netDays);
  return base.toISOString().slice(0, 10);
}

/**
 * Flatten a Profit & Loss report to its three headline numbers for the read summary. The QBO
 * report tree labels summary rows by group ("Income", "Expenses", "NetIncome"); we read the last
 * column value of each matching summary row. Missing rows return null rather than 0 so the
 * caller can tell "zero" from "not reported".
 */
export type ProfitAndLossSummary = {
  reportName: string | null;
  period: { start: string | null; end: string | null };
  totalIncome: number | null;
  totalExpenses: number | null;
  netIncome: number | null;
};

function lastNumeric(colData: { value?: string }[] | undefined): number | null {
  if (!colData || colData.length === 0) return null;
  for (let i = colData.length - 1; i >= 0; i--) {
    const raw = colData[i]?.value;
    if (raw === undefined || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function summarizeProfitAndLoss(report: ProfitAndLossReport): ProfitAndLossSummary {
  const byGroup = new Map<string, number | null>();
  const rows = report.Rows?.Row ?? [];
  for (const row of rows) {
    if (!row.group) continue;
    byGroup.set(row.group, lastNumeric(row.Summary?.ColData));
  }
  return {
    reportName: report.Header?.ReportName ?? null,
    period: {
      start: report.Header?.StartPeriod ?? null,
      end: report.Header?.EndPeriod ?? null,
    },
    totalIncome: byGroup.get("Income") ?? null,
    totalExpenses: byGroup.get("Expenses") ?? null,
    netIncome: byGroup.get("NetIncome") ?? null,
  };
}
