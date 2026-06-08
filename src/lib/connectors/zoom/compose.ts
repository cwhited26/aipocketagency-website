// connectors/zoom/compose.ts — cross-connector composition (task items 6 + 10).
//
// When PA stages a meeting on Google Calendar (create_event), the calendar lane calls
// composeZoomForEvent at EXECUTION time — i.e. AFTER the owner has approved the calendar event in
// the Inbox. If the owner has Zoom connected, this spawns a real Zoom meeting with the same topic +
// time, and returns the join_url so the calendar lane can inject it into the event description (and
// location). The owner's single approval of the calendar event covers the Zoom-link generation,
// which is the lowest-risk write in the set ("no real-world side effect until someone joins").
//
// Graceful fallback (task item 6): if Zoom isn't connected, this returns { status: "skipped" } and
// the calendar lane falls back to Google Meet (the event's own conferenceData) or no link at all.
// A Zoom API failure returns { status: "failed", reason } — surfaced in the calendar summary, never
// silently swallowed, and the calendar event is still created (just without a Zoom link).
//
// The drafter's OTHER composition target — an outbound email — is model-driven: the system prompt
// teaches the chain create_meeting → get_meeting_link → include join_url in the email body. (A
// Calendly connector isn't shipped yet, so the booking-confirmation path lands once it exists; the
// same join_url is the payload it will carry.)

import { fetchZoomConnectionPublic } from "@/lib/pa-zoom-connections";
import { executeZoomAction } from "./index";
import { withZoomLine } from "./format";

export type ZoomCompositionResult =
  | { status: "attached"; joinUrl: string; meetingId: string }
  | { status: "skipped"; reason: "not_connected" }
  | { status: "failed"; reason: string };

export type ComposeZoomForEventInput = {
  userId: string;
  topic: string;
  startIso: string;
  endIso?: string;
  durationMinutes?: number;
  agenda?: string;
  timezone?: string;
  ownerEmail?: string | null;
};

/**
 * Create a Zoom meeting matching a calendar event's topic + time, when the owner has Zoom
 * connected. Returns the join_url to inject, or a typed skip/failure the caller surfaces.
 */
export async function composeZoomForEvent(
  input: ComposeZoomForEventInput,
): Promise<ZoomCompositionResult> {
  const conn = await fetchZoomConnectionPublic(input.userId);
  if (!conn.ok || !conn.data || conn.data.status === "revoked" || !conn.data.zoom_user_id) {
    return { status: "skipped", reason: "not_connected" };
  }

  const payload: Record<string, unknown> = {
    topic: input.topic,
    start_time: input.startIso,
  };
  if (typeof input.durationMinutes === "number") payload.duration_minutes = input.durationMinutes;
  else if (input.endIso) payload.end_time = input.endIso;
  else payload.duration_minutes = 30;
  if (input.agenda) payload.agenda = input.agenda;
  if (input.timezone) payload.timezone = input.timezone;

  const result = await executeZoomAction({
    userId: input.userId,
    action: "create_meeting",
    payload,
    ownerEmail: input.ownerEmail ?? conn.data.email,
  });
  if (!result.ok) return { status: "failed", reason: result.error };

  const joinUrl = typeof result.data.joinUrl === "string" ? result.data.joinUrl : null;
  const meetingId = typeof result.data.meetingId === "string" ? result.data.meetingId : null;
  if (!joinUrl || !meetingId) {
    return { status: "failed", reason: "Zoom did not return a join link." };
  }
  return { status: "attached", joinUrl, meetingId };
}

/**
 * Inject a Zoom join link into a calendar event's description + location. Pure — the calendar lane
 * applies the returned fields to its create_event payload. Location is set to the join_url only when
 * the event has no explicit location (a physical address wins).
 */
export function applyZoomToEventFields(
  fields: { description?: string; location?: string },
  joinUrl: string,
): { description: string; location: string } {
  return {
    description: withZoomLine(fields.description, joinUrl),
    location: fields.location && fields.location.trim() ? fields.location : joinUrl,
  };
}
