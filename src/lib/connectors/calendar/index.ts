// connectors/calendar/index.ts — the Calendar connector entry point.
//
// Exposes the action list + per-action approval gate (for the approval middleware and UI), and
// the TS executor that actually performs an action against the Google Calendar API. The
// executor is invoked in two places:
//   • /api/connections/calendar/events  → list_events (read, no approval)
//   • /api/orchestrator/approvals/[id]   → a gated write, on owner approval ("fires on approve")
//
// Per the Wave B contract, a sub-agent never calls Google directly: it stages the action via
// the approval middleware (lib/orchestrator/tool-use.ts → stageConnectorAction), which scope-
// checks it (ContainmentGuard) and writes the Inbox + approval + audit rows. The runtime's
// blocked call resumes when the owner approves and this executor runs.

import {
  fetchCalendarConnectionFull,
  markCalendarConnectionError,
} from "@/lib/pa-calendar-connections";
import { ensureFreshCalendarAccessToken, hasCalendarScope } from "./oauth";
import { composeZoomForEvent, applyZoomToEventFields } from "@/lib/connectors/zoom/compose";
import type { ActionExecOutcome, CalendarActionMeta, CalendarActionName, ApprovalGate } from "./types";

import { listEventsAction, ListEventsInputSchema } from "./actions/list_events";
import { createEventAction, CreateEventInputSchema } from "./actions/create_event";
import { updateEventAction, UpdateEventInputSchema } from "./actions/update_event";
import { cancelEventAction, CancelEventInputSchema } from "./actions/cancel_event";
import { proposeTimesAction, ProposeTimesInputSchema } from "./actions/propose_times";

export const CONNECTOR = "calendar" as const;

// ── Action registry (meta only — safe to surface in the UI / scope lists) ──────────────────
export const CALENDAR_ACTIONS: readonly CalendarActionMeta[] = [
  listEventsAction,
  createEventAction,
  updateEventAction,
  cancelEventAction,
  proposeTimesAction,
].map((a) => ({
  name: a.name,
  connector: CONNECTOR,
  action: a.action,
  description: a.description,
  gate: a.gate,
}));

const GATES: Record<CalendarActionName, ApprovalGate> = {
  list_events: listEventsAction.gate,
  create_event: createEventAction.gate,
  update_event: updateEventAction.gate,
  cancel_event: cancelEventAction.gate,
  propose_times: proposeTimesAction.gate,
};

const KNOWN_ACTIONS = new Set<string>(Object.keys(GATES));

export function isCalendarAction(action: string): action is CalendarActionName {
  return KNOWN_ACTIONS.has(action);
}

export function calendarActionGate(action: CalendarActionName): ApprovalGate {
  return GATES[action];
}

/** Read-only actions bypass the approval Inbox entirely. */
export function isCalendarReadOnly(action: CalendarActionName): boolean {
  return GATES[action] === "read";
}

/** True iff the action is auto-approve eligible without clearing the trust window (draft/read). */
export function isCalendarAutoApproveEligibleByDefault(action: CalendarActionName): boolean {
  return GATES[action] === "read" || GATES[action] === "auto";
}

// ── Execute against the Calendar API (payload validated per-action) ─────────────────────────

function badPayload(message: string): ActionExecOutcome {
  return { ok: false, status: 422, error: message, authError: false };
}

/**
 * Validate `payload` with the action's schema and run it. `requestId` is the idempotency seed
 * for create_event's Meet provisioning (derive it deterministically from the run/approval id).
 */
export async function executeCalendarAction(
  action: CalendarActionName,
  args: { accessToken: string; payload: Record<string, unknown>; requestId: string },
): Promise<ActionExecOutcome> {
  switch (action) {
    case "list_events": {
      const parsed = ListEventsInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await listEventsAction.execute({ accessToken: args.accessToken, input: parsed.data });
      if (!r.ok) return r;
      return { ok: true, summary: `Found ${r.data.events.length} event(s).`, data: { events: r.data.events } };
    }
    case "create_event": {
      const parsed = CreateEventInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await createEventAction.execute({
        accessToken: args.accessToken,
        input: parsed.data,
        requestId: args.requestId,
      });
      if (!r.ok) return r;
      return {
        ok: true,
        summary: `Created "${parsed.data.title}" (${r.data.eventId}).`,
        data: { eventId: r.data.eventId, htmlLink: r.data.htmlLink, meetLink: r.data.meetLink },
      };
    }
    case "update_event": {
      const parsed = UpdateEventInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await updateEventAction.execute({ accessToken: args.accessToken, input: parsed.data });
      if (!r.ok) return r;
      return {
        ok: true,
        summary: `Updated event ${r.data.eventId}.`,
        data: { eventId: r.data.eventId, htmlLink: r.data.htmlLink },
      };
    }
    case "cancel_event": {
      const parsed = CancelEventInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await cancelEventAction.execute({ accessToken: args.accessToken, input: parsed.data });
      if (!r.ok) return r;
      return { ok: true, summary: `Canceled event ${r.data.eventId}.`, data: { eventId: r.data.eventId } };
    }
    case "propose_times": {
      const parsed = ProposeTimesInputSchema.safeParse(args.payload);
      if (!parsed.success) return badPayload(parsed.error.message);
      const r = await proposeTimesAction.execute({ accessToken: args.accessToken, input: parsed.data });
      if (!r.ok) return r;
      return { ok: true, summary: `Proposed ${r.data.slots.length} slot(s).`, data: { slots: r.data.slots } };
    }
    default: {
      // Exhaustiveness: every CalendarActionName is handled above.
      const _never: never = action;
      return badPayload(`Unknown calendar action: ${String(_never)}`);
    }
  }
}

// ── High-level: resolve the connection + token, then execute (used on approve / read) ───────

export type RunCalendarResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; reauth: boolean };

/**
 * Resolve the owner's Calendar connection, ensure a fresh access token (refreshing + flipping
 * to reauth on failure), then execute the action. `reauth:true` signals the caller to surface
 * the reconnect path (a dead grant, missing connection, or missing calendar.events scope).
 */
export async function runCalendarAction(input: {
  userId: string;
  action: CalendarActionName;
  payload: Record<string, unknown>;
  requestId: string;
}): Promise<RunCalendarResult> {
  const conn = await fetchCalendarConnectionFull(input.userId);
  if (!conn.ok) return { ok: false, status: conn.status, error: conn.error, reauth: false };
  if (!conn.data || conn.data.status === "revoked") {
    return {
      ok: false,
      status: 409,
      error: "Connect Google Calendar in Settings → Connections first.",
      reauth: true,
    };
  }
  if (!hasCalendarScope(conn.data.scopes)) {
    return {
      ok: false,
      status: 403,
      error:
        "Re-authorize Google Calendar to enable scheduling — Settings → Connections → Reconnect. " +
        "Your earlier connection didn't include calendar permission.",
      reauth: true,
    };
  }

  const token = await ensureFreshCalendarAccessToken(conn.data, conn.data.email);
  if (!token.ok) {
    return {
      ok: false,
      status: 502,
      error: "Google Calendar authorization expired — reconnect Calendar in Settings.",
      reauth: true,
    };
  }

  // Cross-connector composition (Zoom Connection lane, task items 6 + 10): when PA creates a
  // calendar event for a meeting (it has attendees) and the owner has Zoom connected, spawn a Zoom
  // meeting with the same topic + time and inject its join link into the event description +
  // location. This runs at EXECUTION time — after the owner approved the event — so the single
  // approval covers the (lowest-risk) Zoom-link generation. Fallback is graceful: if Zoom isn't
  // connected, the event keeps whatever conferencing it already had (Google Meet via conference_data,
  // or none). A Zoom failure is surfaced in the summary, never swallowed, and the event still books.
  let payload = input.payload;
  let zoomNote = "";
  if (input.action === "create_event") {
    const composed = await maybeComposeZoom(input.userId, conn.data.email, payload);
    payload = composed.payload;
    zoomNote = composed.note;
  }

  const outcome = await executeCalendarAction(input.action, {
    accessToken: token.data,
    payload,
    requestId: input.requestId,
  });
  if (!outcome.ok) {
    if (outcome.authError) {
      await markCalendarConnectionError(conn.data.id);
      return { ok: false, status: outcome.status, error: outcome.error, reauth: true };
    }
    return { ok: false, status: outcome.status, error: outcome.error, reauth: false };
  }
  return { ok: true, summary: `${outcome.summary}${zoomNote}`, data: outcome.data };
}

/**
 * Attach a Zoom join link to a create_event payload when the owner has Zoom connected and the event
 * is a meeting (has attendees) without an existing video link. Returns the (possibly enriched)
 * payload + a human note for the summary. Never throws — composeZoomForEvent returns typed
 * skip/failure outcomes.
 */
async function maybeComposeZoom(
  userId: string,
  ownerEmail: string | null,
  payload: Record<string, unknown>,
): Promise<{ payload: Record<string, unknown>; note: string }> {
  const attendees = Array.isArray(payload.attendees) ? payload.attendees : [];
  const description = typeof payload.description === "string" ? payload.description : "";
  const title = typeof payload.title === "string" ? payload.title : "";
  const start = typeof payload.start === "string" ? payload.start : "";
  // Only compose for a real meeting (attendees) we can place in time, and don't double up if the
  // description already carries a video link.
  if (attendees.length === 0 || !title || !start || /zoom\.us|meet\.google\.com/.test(description)) {
    return { payload, note: "" };
  }

  const composed = await composeZoomForEvent({
    userId,
    topic: title,
    startIso: start,
    endIso: typeof payload.end === "string" ? payload.end : undefined,
    agenda: description || undefined,
    timezone: typeof payload.timezone === "string" ? payload.timezone : undefined,
    ownerEmail,
  });

  if (composed.status === "attached") {
    const fields = applyZoomToEventFields(
      { description, location: typeof payload.location === "string" ? payload.location : undefined },
      composed.joinUrl,
    );
    return {
      // conference_data:false so the event doesn't also provision a Google Meet alongside Zoom.
      payload: { ...payload, description: fields.description, location: fields.location, conference_data: false },
      note: ` Added a Zoom link (${composed.joinUrl}).`,
    };
  }
  if (composed.status === "failed") {
    return { payload, note: ` (Couldn't attach a Zoom link: ${composed.reason})` };
  }
  // skipped — Zoom not connected; leave the event's own conferencing untouched.
  return { payload, note: "" };
}
