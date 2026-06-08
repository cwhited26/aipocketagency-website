// connectors/stripe/types.ts — shared vocabulary for the Stripe Connect connector.
//
// This connector acts on the OWNER's connected Stripe account (Stripe Connect Standard), never
// PA's platform Stripe. See lib/connectors/stripe/api.ts for how connected-account context is
// threaded (the Stripe-Account header).

// The approval gate for an action (Connections Roadmap §2.4):
//   "read"  — read-only; bypasses the approval Inbox entirely (list_customers, list_invoices,
//             get_balance).
//   "gated" — per-action approval; may graduate to auto-approve after the PA-ORCH-4 trust window
//             (create_invoice, create_payment_link).
//   "always_gated" — per-action approval that NEVER becomes auto-approve eligible, regardless of
//             success_count (refund_charge). Refunds move real money OUT and are the prime
//             prompt-injection target (roadmap §2.4 abuse-risk 5), so there is no trust window
//             that ever unlocks them — every single refund is an explicit owner tap.
export type ApprovalGate = "read" | "gated" | "always_gated";

export type StripeActionName =
  | "list_customers"
  | "list_invoices"
  | "get_balance"
  | "create_invoice"
  | "create_payment_link"
  | "refund_charge";

// Listing shape for the UI / scope surfaces (name + gate, no executable bits).
export type StripeActionMeta = {
  name: string;
  connector: "stripe";
  action: StripeActionName;
  description: string;
  gate: ApprovalGate;
};

// Uniform outcome of executing an action, so the approve route + read endpoint handle every
// action the same way without `any`. `summary` is a human one-liner for the audit log.
export type ActionExecOutcome =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; authError: boolean };
