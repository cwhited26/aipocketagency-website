// connectors/calendly/types.ts — shared vocabulary for the Calendly connector.
//
// Calendly is the booking-link infrastructure prospects self-serve through — a different job
// from Google Calendar (the owner's personal schedule). The owner's available meeting types
// (event types), what's actually booked (scheduled events), and single-use booking links live
// here. Reads run inline; the two writes (create_one_off_link, cancel_scheduled_event) stage in
// the Approval Inbox.

// The approval gate for an action (Connections Roadmap §2.x, task items 8–9):
//   "read"  — read-only; bypasses the approval Inbox entirely (list_event_types,
//             list_scheduled_events, list_invitees). Auto-approve eligible from day one.
//   "gated" — per-action approval; a WRITE that always stages in the Inbox. It earns
//             auto-approve eligibility only after clearing its trust window
//             (create_one_off_link N=10 — low-risk, just generates a link; cancel_scheduled_event
//             stays gated far longer — it can frustrate a prospect who already booked).
// There is no "auto" tier here — a Calendly write either reads (no gate) or stages.
export type ApprovalGate = "read" | "gated";

export type CalendlyActionName =
  | "list_event_types"
  | "list_scheduled_events"
  | "list_invitees"
  | "create_one_off_link"
  | "cancel_scheduled_event";

// Listing shape for the UI / scope surfaces (name + gate, no executable bits).
export type CalendlyActionMeta = {
  name: string;
  connector: "calendly";
  action: CalendlyActionName;
  description: string;
  gate: ApprovalGate;
};

// Uniform outcome of executing an action, so the approve route + read endpoints handle every
// action the same way without `any`. `summary` is a human one-liner for the audit log.
export type ActionExecOutcome =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; authError: boolean };

// Result wrapper used across the OAuth + API layers (mirrors CalendarResult / QuickBooksResult).
// authError:true means the Calendly grant is dead and the caller should surface the reconnect path.
export type CalendlyResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };
