// connector.calendar.cancel_event — cancel (delete) an event AS the connected user.
//
// Write action — approval-gated, and the most socially costly of the set: deletion fires
// cancellation notices to every attendee (sendUpdates=all). The dry-run makes that explicit.
//
// Schema + dry-run are pure; only execute() touches the Calendar API.

import { z } from "zod";
import { deleteEvent } from "../api";
import type { CalendarResult } from "../oauth";

const DEFAULT_CALENDAR = "primary";

export const CancelEventInputSchema = z.object({
  event_id: z.string().min(1, "event_id is required"),
  calendar_id: z.string().min(1).optional(),
});
export type CancelEventInput = z.infer<typeof CancelEventInputSchema>;

export function dryRunSummary(input: CancelEventInput): string {
  return [
    `Cancel event ${input.event_id}`,
    "Every attendee receives a cancellation notice. This can't be undone from here.",
  ].join("\n");
}

export type CancelEventAuditFields = {
  connector: "calendar";
  action: "cancel_event";
  calendarId: string;
  eventId: string;
};

export function auditFields(input: CancelEventInput): CancelEventAuditFields {
  return {
    connector: "calendar",
    action: "cancel_event",
    calendarId: input.calendar_id ?? DEFAULT_CALENDAR,
    eventId: input.event_id,
  };
}

export async function execute(args: {
  accessToken: string;
  input: CancelEventInput;
}): Promise<CalendarResult<{ eventId: string }>> {
  const result = await deleteEvent(args.accessToken, {
    calendarId: args.input.calendar_id ?? DEFAULT_CALENDAR,
    eventId: args.input.event_id,
    sendUpdates: true,
  });
  if (!result.ok) return result;
  return { ok: true, data: { eventId: args.input.event_id } };
}

export const cancelEventAction = {
  name: "calendar.cancel_event",
  connector: "calendar",
  action: "cancel_event",
  gate: "gated",
  description:
    "Cancel (delete) an event on the connected Google Calendar, notifying every attendee. " +
    "Approval-gated: stages in the Inbox first; the cancellation sends only on approval.",
  inputSchema: CancelEventInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
