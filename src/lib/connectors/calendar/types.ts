// connectors/calendar/types.ts — shared vocabulary for the Calendar connector.

// The approval gate for an action (Connections Roadmap §2.2, task items 5–6):
//   "read"  — read-only; bypasses the approval Inbox entirely (list_events).
//   "auto"  — auto-approve eligible by default; reads + drafts, no calendar write
//             (propose_times). Fires without a manual tap unless the owner turns it off.
//   "gated" — per-action approval; graduates to auto-approve only after the PA-ORCH-4 trust
//             window (create_event, update_event, cancel_event).
export type ApprovalGate = "read" | "auto" | "gated";

export type CalendarActionName =
  | "list_events"
  | "create_event"
  | "update_event"
  | "cancel_event"
  | "propose_times";

// Listing shape for the UI / scope surfaces (name + gate, no executable bits).
export type CalendarActionMeta = {
  name: string;
  connector: "calendar";
  action: CalendarActionName;
  description: string;
  gate: ApprovalGate;
};

// Uniform outcome of executing an action, so the approve route + read endpoint handle every
// action the same way without `any`. `summary` is a human one-liner for the audit log.
export type ActionExecOutcome =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; authError: boolean };
