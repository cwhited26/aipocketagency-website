// connectors/quickbooks/types.ts — shared vocabulary for the QuickBooks Online connector.

// The approval gate for an action (Connections Roadmap §2.3, task items 5–6):
//   "read"  — read-only; bypasses the approval Inbox entirely (list_customers, list_invoices,
//             run_pl_report). Auto-approve eligible from day one.
//   "gated" — per-action approval; a financial WRITE that always stages in the Inbox. It earns
//             auto-approve eligibility only after clearing a hard-tightened trust window
//             (create_invoice N=10; record_payment N=20, and even then stays opt-in default-off).
//             There is no "auto" tier here — QuickBooks touches the books, so nothing drafts
//             straight through.
export type ApprovalGate = "read" | "gated";

export type QuickBooksActionName =
  | "list_customers"
  | "list_invoices"
  | "run_pl_report"
  | "create_invoice"
  | "record_payment";

// Listing shape for the UI / scope surfaces (name + gate, no executable bits).
export type QuickBooksActionMeta = {
  name: string;
  connector: "quickbooks";
  action: QuickBooksActionName;
  description: string;
  gate: ApprovalGate;
};

// Uniform outcome of executing an action, so the approve route + read endpoint handle every
// action the same way without `any`. `summary` is a human one-liner for the audit log.
export type ActionExecOutcome =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; authError: boolean };

// Result wrapper used across the OAuth + API layers (mirrors CalendarResult). authError:true
// means the Intuit grant is dead and the caller should surface the reconnect path.
export type QuickBooksResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };
