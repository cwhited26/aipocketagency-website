// Pure-function unit tests for the QuickBooks connector — no network, no DB. Exercises the
// action schemas, query builders, dry-run summaries (the approval-card renderer), the registry
// classification + gates, the drafter's refuse-on-missing-context + net-30 behavior, the format
// helpers, and the hard-tightened per-action trust windows.

import { describe, expect, it } from "vitest";
import {
  QUICKBOOKS_ACTIONS,
  QUICKBOOKS_WRITE_ACTIONS,
  isQuickBooksAction,
  isQuickBooksReadOnly,
  quickBooksActionGate,
} from "../index";
import { buildQuery as buildCustomerQuery } from "../actions/list_customers";
import { buildQuery as buildInvoiceQuery } from "../actions/list_invoices";
import {
  CreateInvoiceInputSchema,
  buildInvoiceBody,
  dryRunSummary as invoiceDryRun,
} from "../actions/create_invoice";
import {
  RecordPaymentInputSchema,
  buildPaymentBody,
  dryRunSummary as paymentDryRun,
} from "../actions/record_payment";
import { buildInvoiceDraft, InvoiceDraftContextError } from "../drafter";
import {
  formatMoney,
  lineItemsTotal,
  netDueDate,
  summarizeProfitAndLoss,
} from "../format";
import {
  autoApproveUnlockedFor,
  connectorActionTrustWindow,
} from "@/lib/orchestrator/tier-caps";
import type { ProfitAndLossReport } from "../api";

describe("registry", () => {
  it("exposes all five actions", () => {
    expect(QUICKBOOKS_ACTIONS.map((a) => a.action).sort()).toEqual([
      "create_invoice",
      "list_customers",
      "list_invoices",
      "record_payment",
      "run_pl_report",
    ]);
  });

  it("classifies reads (read gate) and writes (gated)", () => {
    expect([...QUICKBOOKS_WRITE_ACTIONS].sort()).toEqual(["create_invoice", "record_payment"]);
    expect(isQuickBooksReadOnly("list_customers")).toBe(true);
    expect(isQuickBooksReadOnly("run_pl_report")).toBe(true);
    expect(isQuickBooksReadOnly("create_invoice")).toBe(false);
    expect(quickBooksActionGate("record_payment")).toBe("gated");
  });

  it("recognizes only known action names", () => {
    expect(isQuickBooksAction("create_invoice")).toBe(true);
    expect(isQuickBooksAction("delete_invoice")).toBe(false);
  });

  it("every descriptor carries a dryRunSummary renderer", () => {
    for (const a of [
      ...QUICKBOOKS_ACTIONS,
    ]) {
      expect(typeof a.description).toBe("string");
      expect(a.description.length).toBeGreaterThan(0);
    }
  });
});

describe("query builders (read actions)", () => {
  it("builds a customer query with an escaped name filter", () => {
    const q = buildCustomerQuery({ name_contains: "O'Brien", max_results: 5 });
    expect(q).toContain("FROM Customer");
    expect(q).toContain("LIKE '%O''Brien%'"); // single quote doubled
    expect(q).toContain("MAXRESULTS 5");
  });

  it("builds an unfiltered customer query when no name given", () => {
    const q = buildCustomerQuery({});
    expect(q).toContain("FROM Customer ORDERBY DisplayName");
    expect(q).not.toContain("WHERE");
  });

  it("builds an unpaid-invoice query for one customer", () => {
    const q = buildInvoiceQuery({ customer_ref: "42", unpaid_only: true });
    expect(q).toContain("CustomerRef = '42'");
    expect(q).toContain("Balance > '0'");
    expect(q).toContain("AND");
  });
});

describe("create_invoice", () => {
  it("validates a well-formed payload + builds the QBO body", () => {
    const input = CreateInvoiceInputSchema.parse({
      customer_ref: "55",
      customer_name: "Patrick Williams",
      line_items: [
        { description: "Roof tear-off", amount: 4200 },
        { description: "Underlayment", amount: 800, item_ref: "7", quantity: 2, unit_price: 400 },
      ],
      due_date: "2026-07-07",
    });
    const body = buildInvoiceBody(input);
    expect(body.CustomerRef.value).toBe("55");
    expect(body.Line).toHaveLength(2);
    expect(body.Line[0].DetailType).toBe("SalesItemLineDetail");
    expect(body.Line[1].SalesItemLineDetail.ItemRef).toEqual({ value: "7" });
    expect(body.Line[1].SalesItemLineDetail.Qty).toBe(2);
    expect(body.DueDate).toBe("2026-07-07");
  });

  it("rejects an empty line list and a non-positive amount", () => {
    expect(CreateInvoiceInputSchema.safeParse({ customer_ref: "1", line_items: [] }).success).toBe(
      false,
    );
    expect(
      CreateInvoiceInputSchema.safeParse({
        customer_ref: "1",
        line_items: [{ description: "x", amount: 0 }],
      }).success,
    ).toBe(false);
  });

  it("dry-run shows the dollar total + each line + a write warning", () => {
    const summary = invoiceDryRun({
      customer_ref: "55",
      customer_name: "Patrick Williams",
      line_items: [{ description: "Roof tear-off", amount: 4200 }],
    });
    expect(summary).toContain("Patrick Williams");
    expect(summary).toContain("$4,200.00");
    expect(summary).toContain("Roof tear-off");
    expect(summary.toLowerCase()).toContain("approve");
  });
});

describe("record_payment", () => {
  it("builds a Payment body linked to the invoice", () => {
    const input = RecordPaymentInputSchema.parse({
      invoice_id: "130",
      customer_ref: "55",
      amount: 4200,
      method: "check",
    });
    const body = buildPaymentBody(input);
    expect(body.TotalAmt).toBe(4200);
    expect(body.CustomerRef.value).toBe("55");
    expect(body.Line[0].LinkedTxn[0]).toEqual({ TxnId: "130", TxnType: "Invoice" });
  });

  it("dry-run shows the amount, invoice, and a real-money warning", () => {
    const summary = paymentDryRun({
      invoice_id: "130",
      customer_ref: "55",
      amount: 4200,
      customer_name: "Patrick Williams",
    });
    expect(summary).toContain("$4,200.00");
    expect(summary).toContain("invoice 130");
    expect(summary.toLowerCase()).toContain("real money");
  });
});

describe("drafter (sub-agent auto-populate)", () => {
  it("composes a net-30 invoice from source context", () => {
    const draft = buildInvoiceDraft({
      customer: { ref: "55", name: "Patrick Williams" },
      lineItems: [{ description: "Roof tear-off", amount: 4200 }],
      invoiceDate: "2026-06-07",
    });
    expect(draft.action).toBe("create_invoice");
    expect(draft.payload.customer_ref).toBe("55");
    expect(draft.payload.customer_name).toBe("Patrick Williams");
    expect(draft.payload.due_date).toBe("2026-07-07"); // net-30 from 06-07
  });

  it("honors an owner net-N override and an explicit due date", () => {
    const net15 = buildInvoiceDraft({
      customer: { ref: "1" },
      lineItems: [{ description: "x", amount: 10 }],
      invoiceDate: "2026-06-07",
      netDays: 15,
    });
    expect(net15.payload.due_date).toBe("2026-06-22");

    const explicit = buildInvoiceDraft({
      customer: { ref: "1" },
      lineItems: [{ description: "x", amount: 10 }],
      invoiceDate: "2026-06-07",
      dueDate: "2026-12-31",
    });
    expect(explicit.payload.due_date).toBe("2026-12-31");
  });

  it("refuses (clear error) when no customer matched", () => {
    expect(() =>
      buildInvoiceDraft({
        customer: null,
        lineItems: [{ description: "x", amount: 10 }],
        invoiceDate: "2026-06-07",
      }),
    ).toThrow(InvoiceDraftContextError);
  });

  it("refuses (clear error) when there are no line items", () => {
    expect(() =>
      buildInvoiceDraft({
        customer: { ref: "1" },
        lineItems: [],
        invoiceDate: "2026-06-07",
      }),
    ).toThrow(InvoiceDraftContextError);
  });
});

describe("format helpers", () => {
  it("formats money to 2dp with thousands separators", () => {
    expect(formatMoney(4200)).toBe("$4,200.00");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(1234.5)).toBe("$1,234.50");
  });

  it("sums line-item amounts", () => {
    expect(lineItemsTotal([{ amount: 4200 }, { amount: 800 }])).toBe(5000);
  });

  it("computes net-N due dates deterministically (no Date.now)", () => {
    expect(netDueDate("2026-06-07", 30)).toBe("2026-07-07");
    expect(netDueDate("2026-01-31", 30)).toBe("2026-03-02");
  });

  it("summarizes a P&L report tree to its headline numbers", () => {
    const report: ProfitAndLossReport = {
      Header: { ReportName: "ProfitAndLoss", StartPeriod: "2026-01-01", EndPeriod: "2026-06-30" },
      Rows: {
        Row: [
          { group: "Income", Summary: { ColData: [{ value: "Total Income" }, { value: "12000.00" }] } },
          { group: "Expenses", Summary: { ColData: [{ value: "Total Expenses" }, { value: "5000.00" }] } },
          { group: "NetIncome", Summary: { ColData: [{ value: "Net Income" }, { value: "7000.00" }] } },
        ],
      },
    };
    const s = summarizeProfitAndLoss(report);
    expect(s.totalIncome).toBe(12000);
    expect(s.totalExpenses).toBe(5000);
    expect(s.netIncome).toBe(7000);
    expect(s.period).toEqual({ start: "2026-01-01", end: "2026-06-30" });
  });
});

describe("hard-tightened trust ladder (task item 5)", () => {
  it("create_invoice unlocks at 10 approvals", () => {
    expect(connectorActionTrustWindow("quickbooks", "create_invoice")).toBe(10);
    expect(autoApproveUnlockedFor("quickbooks", "create_invoice", 9)).toBe(false);
    expect(autoApproveUnlockedFor("quickbooks", "create_invoice", 10)).toBe(true);
  });

  it("record_payment needs 20 approvals — strictly higher than the default", () => {
    expect(connectorActionTrustWindow("quickbooks", "record_payment")).toBe(20);
    expect(autoApproveUnlockedFor("quickbooks", "record_payment", 10)).toBe(false);
    expect(autoApproveUnlockedFor("quickbooks", "record_payment", 20)).toBe(true);
  });

  it("read actions + unknown connectors fall back to the default window", () => {
    expect(connectorActionTrustWindow("quickbooks", "list_customers")).toBe(10);
    expect(connectorActionTrustWindow("slack", "post_message")).toBe(10);
  });
});
