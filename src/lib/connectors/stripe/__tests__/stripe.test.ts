// Pure-function unit tests for the Stripe Connect connector — no network, no DB. Exercises the
// action registry + gates, the money formatting, the dry-run renderers (the approval-card text),
// the always-gated refund invariant, the drafter's refuse-on-missing-context behavior, and the
// rate-cap decision. The refund invariant is pinned here so a future edit can't silently let
// refund_charge become auto-approve eligible.

import { describe, expect, it } from "vitest";
import {
  STRIPE_ACTIONS,
  STRIPE_WRITE_ACTIONS,
  isStripeAction,
  isStripeReadOnly,
  isStripeNeverAutoApprove,
  isStripeAutoApproveEligibleByDefault,
  stripeActionGate,
  rateCapExceeded,
  stripeMaxWritesPerMin,
} from "../index";
import { currencyDecimals, formatAmount, toMinorUnits } from "../format";
import { listCustomersAction } from "../actions/list_customers";
import { createInvoiceAction } from "../actions/create_invoice";
import { createPaymentLinkAction } from "../actions/create_payment_link";
import { refundChargeAction } from "../actions/refund_charge";
import {
  buildInvoiceDraft,
  buildPaymentLinkDraft,
  buildRefundDraft,
  resolveCustomerId,
  StripeDraftContextError,
} from "../drafter";
import { autoApproveUnlockedFor, connectorActionTrustWindow } from "@/lib/orchestrator/tier-caps";

describe("registry", () => {
  it("exposes all six actions", () => {
    expect(STRIPE_ACTIONS.map((a) => a.action).sort()).toEqual([
      "create_invoice",
      "create_payment_link",
      "get_balance",
      "list_customers",
      "list_invoices",
      "refund_charge",
    ]);
  });

  it("classifies reads vs writes", () => {
    expect([...STRIPE_WRITE_ACTIONS].sort()).toEqual([
      "create_invoice",
      "create_payment_link",
      "refund_charge",
    ]);
    expect(isStripeReadOnly("list_customers")).toBe(true);
    expect(isStripeReadOnly("get_balance")).toBe(true);
    expect(isStripeReadOnly("refund_charge")).toBe(false);
  });

  it("recognizes known actions and rejects unknown", () => {
    expect(isStripeAction("create_invoice")).toBe(true);
    expect(isStripeAction("delete_everything")).toBe(false);
  });

  it("gates: reads=read, invoice/link=gated, refund=always_gated", () => {
    expect(stripeActionGate("list_invoices")).toBe("read");
    expect(stripeActionGate("create_invoice")).toBe("gated");
    expect(stripeActionGate("create_payment_link")).toBe("gated");
    expect(stripeActionGate("refund_charge")).toBe("always_gated");
  });
});

describe("refund_charge is never auto-approve eligible (roadmap §2.4)", () => {
  it("isStripeNeverAutoApprove is true ONLY for refund_charge", () => {
    expect(isStripeNeverAutoApprove("refund_charge")).toBe(true);
    expect(isStripeNeverAutoApprove("create_invoice")).toBe(false);
    expect(isStripeNeverAutoApprove("create_payment_link")).toBe(false);
    expect(isStripeNeverAutoApprove("list_customers")).toBe(false);
  });

  it("refund_charge is not auto-approve eligible by default (nor are gated writes)", () => {
    expect(isStripeAutoApproveEligibleByDefault("refund_charge")).toBe(false);
    expect(isStripeAutoApproveEligibleByDefault("create_invoice")).toBe(false);
    expect(isStripeAutoApproveEligibleByDefault("list_customers")).toBe(true);
  });

  it("the trust window for stripe:refund_charge is unreachable — it NEVER unlocks", () => {
    // The connector declares it never-eligible; the orchestrator's trust window enforces it
    // (unreachable override). The two must agree — that's the safety contract.
    expect(isStripeNeverAutoApprove("refund_charge")).toBe(true);
    expect(connectorActionTrustWindow("stripe", "refund_charge")).toBe(Number.POSITIVE_INFINITY);
    expect(autoApproveUnlockedFor("stripe", "refund_charge", 1_000_000)).toBe(false);
  });

  it("gated stripe writes DO unlock at the standard trust window (N=10)", () => {
    expect(autoApproveUnlockedFor("stripe", "create_invoice", 9)).toBe(false);
    expect(autoApproveUnlockedFor("stripe", "create_invoice", 10)).toBe(true);
    expect(autoApproveUnlockedFor("stripe", "create_payment_link", 10)).toBe(true);
  });
});

describe("money formatting", () => {
  it("formats minor units to display strings", () => {
    expect(formatAmount(1999, "usd")).toBe("$19.99");
    expect(formatAmount(500, "jpy")).toBe("¥500"); // zero-decimal currency
  });

  it("knows zero-decimal currencies", () => {
    expect(currencyDecimals("usd")).toBe(2);
    expect(currencyDecimals("JPY")).toBe(0);
  });

  it("converts major to minor units with rounding", () => {
    expect(toMinorUnits(19.99, "usd")).toBe(1999);
    expect(toMinorUnits(500, "jpy")).toBe(500);
    expect(toMinorUnits(-1, "usd")).toBeNull();
  });
});

describe("dry-run renderers (approval-card text)", () => {
  it("every action carries a dryRunSummary function", () => {
    for (const a of [listCustomersAction, createInvoiceAction, createPaymentLinkAction, refundChargeAction]) {
      expect(typeof a.dryRunSummary).toBe("function");
    }
  });

  it("create_invoice surfaces the exact total", () => {
    const text = createInvoiceAction.dryRunSummary({
      customer: "cus_123",
      line_items: [
        { amount: 100, description: "Design" },
        { amount: 50.5, description: "Hosting" },
      ],
    });
    expect(text).toContain("$150.50");
    expect(text).toContain("cus_123");
  });

  it("refund dry-run warns money moves out", () => {
    const text = refundChargeAction.dryRunSummary({ charge_id: "ch_1" });
    expect(text).toContain("ch_1");
    expect(text.toLowerCase()).toContain("out of your account");
  });
});

describe("drafter safety", () => {
  it("refuses to invoice without a resolved customer", () => {
    expect(() =>
      buildInvoiceDraft({ customerId: null, lineItems: [{ amount: 10, description: "x" }] }),
    ).toThrow(StripeDraftContextError);
  });

  it("builds a valid invoice draft from resolved context", () => {
    const draft = buildInvoiceDraft({
      customerId: "cus_9",
      lineItems: [{ amount: 200, description: "Roof repair" }],
      currency: "usd",
    });
    expect(draft.customer).toBe("cus_9");
    expect(draft.line_items).toHaveLength(1);
  });

  it("refuses a payment link without an amount", () => {
    expect(() => buildPaymentLinkDraft({ amount: 0, description: "Deposit" })).toThrow(
      StripeDraftContextError,
    );
  });

  it("refuses a refund without a charge resolved from a real read", () => {
    expect(() => buildRefundDraft(null)).toThrow(StripeDraftContextError);
    expect(() => buildRefundDraft(undefined)).toThrow(StripeDraftContextError);
  });

  it("builds a refund only from a resolved charge", () => {
    const draft = buildRefundDraft({ id: "ch_42", amount: 5000, currency: "usd" });
    expect(draft.charge_id).toBe("ch_42");
  });

  it("resolves a customer id by unambiguous name match", () => {
    const customers = [
      { id: "cus_a", name: "Acme Roofing", email: null },
      { id: "cus_b", name: "Beta LLC", email: null },
    ];
    expect(resolveCustomerId(customers, "acme roofing")).toBe("cus_a");
    expect(resolveCustomerId(customers, "Acme")).toBe("cus_a"); // partial, unambiguous
    expect(resolveCustomerId(customers, "nobody")).toBeNull();
  });
});

describe("write rate cap", () => {
  it("blocks once recent writes reach the cap", () => {
    expect(rateCapExceeded(9, 10)).toBe(false);
    expect(rateCapExceeded(10, 10)).toBe(true);
  });

  it("default cap is a positive number", () => {
    expect(stripeMaxWritesPerMin()).toBeGreaterThan(0);
  });
});
