// connector.calendar.create_event — schedule a new event AS the connected user.
//
// Write action — approval-gated (task items 5–6): a sub-agent stages this in the Inbox; it
// fires only after the owner approves (or once the trust window unlocks auto-approve). When
// attendees are present the API sends invitations (sendUpdates=all). conference_data optionally
// provisions a Google Meet link.
//
// MIME-free: the schema, dry-run, and request-body builder are pure (no network/DB); only
// execute() touches the Calendar API.

import { z } from "zod";
import { insertEvent, type EventWriteBody } from "../api";
import type { CalendarResult } from "../oauth";
import { toEventDateTime, humanList } from "../format";

const DEFAULT_CALENDAR = "primary";

export const CreateEventInputSchema = z.object({
  title: z.string().min(1, "title is required"),
  // RFC 3339 datetime (timed) or YYYY-MM-DD (all-day).
  start: z.string().min(1, "start is required"),
  end: z.string().min(1, "end is required"),
  attendees: z.array(z.string().email()).max(100).optional(),
  description: z.string().max(8_000).optional(),
  location: z.string().max(1_000).optional(),
  // When true, provision a Google Meet link on the event.
  conference_data: z.boolean().optional(),
  timezone: z.string().min(1).optional(),
  calendar_id: z.string().min(1).optional(),
});
export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

/**
 * Build the Calendar event resource body. `requestId` is supplied (not random) so the caller
 * can derive it deterministically from the run for idempotency — Date.now()/random are avoided.
 */
export function buildEventBody(input: CreateEventInput, requestId: string): EventWriteBody {
  const body: EventWriteBody = {
    summary: input.title,
    start: toEventDateTime(input.start, input.timezone),
    end: toEventDateTime(input.end, input.timezone),
  };
  if (input.description) body.description = input.description;
  if (input.location) body.location = input.location;
  if (input.attendees && input.attendees.length > 0) {
    body.attendees = input.attendees.map((email) => ({ email }));
  }
  if (input.conference_data) {
    body.conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  return body;
}

export function dryRunSummary(input: CreateEventInput): string {
  const lines: string[] = [];
  lines.push(`Create event "${input.title}"`);
  lines.push(`When: ${input.start} → ${input.end}${input.timezone ? ` (${input.timezone})` : ""}`);
  if (input.location) lines.push(`Where: ${input.location}`);
  if (input.attendees && input.attendees.length > 0) {
    lines.push(`Invites ${humanList(input.attendees)} (they'll be notified).`);
  }
  if (input.conference_data) lines.push("Adds a Google Meet link.");
  if (input.description) {
    const flat = input.description.replace(/\s+/g, " ").trim();
    lines.push("", flat.length > 280 ? `${flat.slice(0, 280).trimEnd()}…` : flat);
  }
  return lines.join("\n");
}

export type CreateEventAuditFields = {
  connector: "calendar";
  action: "create_event";
  calendarId: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  conference: boolean;
};

export function auditFields(input: CreateEventInput): CreateEventAuditFields {
  return {
    connector: "calendar",
    action: "create_event",
    calendarId: input.calendar_id ?? DEFAULT_CALENDAR,
    title: input.title,
    start: input.start,
    end: input.end,
    attendees: input.attendees ?? [],
    conference: Boolean(input.conference_data),
  };
}

export async function execute(args: {
  accessToken: string;
  input: CreateEventInput;
  requestId: string;
}): Promise<CalendarResult<{ eventId: string; htmlLink: string | null; meetLink: string | null }>> {
  const body = buildEventBody(args.input, args.requestId);
  const sendUpdates = Boolean(args.input.attendees && args.input.attendees.length > 0);
  const result = await insertEvent(args.accessToken, {
    calendarId: args.input.calendar_id ?? DEFAULT_CALENDAR,
    body,
    sendUpdates,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      eventId: result.data.id,
      htmlLink: result.data.htmlLink ?? null,
      meetLink: result.data.hangoutLink ?? null,
    },
  };
}

export const createEventAction = {
  name: "calendar.create_event",
  connector: "calendar",
  action: "create_event",
  gate: "gated",
  description:
    "Schedule a new event on the connected Google Calendar, optionally inviting attendees and " +
    "adding a Google Meet link. Approval-gated: stages in the Inbox first; invites send only " +
    "on approval.",
  inputSchema: CreateEventInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
