// connectors/zoom/types.ts — shared vocabulary for the Zoom connector.
//
// This connector acts on the OWNER's own Zoom account: each PA owner connects their Zoom via
// User-level OAuth (authorization-code flow), so the access token is the owner's, scoped to the
// scopes Chase grants the Zoom app (meeting:read / meeting:write / user:read). Connected-account
// context is the access token itself + the owner's Zoom user id (zoom_user_id) for the
// /users/{userId}/meetings paths. See lib/connectors/zoom/api.ts for the REST client.

// The approval gate for an action (Connections Roadmap §2.2 model, task items 7–8):
//   "read"  — read-only; bypasses the approval Inbox entirely (list_upcoming_meetings,
//             get_meeting_link). Auto-approve eligible from day one.
//   "gated" — per-action approval; may graduate to auto-approve after the PA-ORCH-4 trust window.
//             create_meeting clears at the default window (N=10 — generating a Zoom link has no
//             real-world side effect until someone joins). update_meeting / cancel_meeting carry a
//             tightened window (they touch a meeting already on the books) — see tier-caps.ts
//             CONNECTOR_ACTION_TRUST_OVERRIDES.
export type ApprovalGate = "read" | "gated";

export type ZoomActionName =
  | "list_upcoming_meetings"
  | "create_meeting"
  | "update_meeting"
  | "cancel_meeting"
  | "get_meeting_link";

// Listing shape for the UI / scope surfaces (name + gate, no executable bits).
export type ZoomActionMeta = {
  name: string;
  connector: "zoom";
  action: ZoomActionName;
  description: string;
  gate: ApprovalGate;
};

// Uniform outcome of executing an action, so the approve route + read endpoint handle every
// action the same way without `any`. `summary` is a human one-liner for the audit log.
export type ActionExecOutcome =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; authError: boolean };
