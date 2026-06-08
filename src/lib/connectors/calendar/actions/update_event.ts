// connector.calendar.update_event — patch an existing event AS the connected user.
//
// Write action — approval-gated (task items 5–6). PATCH semantics: only the fields supplied are
// changed; omitted fields are left intact. When attendees are present the API re-notifies them
// (sendUpdates=all). At least one mutable field beyond event_id must be supplied.
//
// Schema, dry-run, and body builder are pure; only execute() touches the Calendar API.

import { z } from "zod";
import { patchEvent, type EventWriteBody } from "../api";
import type { CalendarResult } from "../oauth";
import { toEventDateTime, humanList } from "../format";

const DEFAULT_CALENDAR = "primary";

export const UpdateEventInputSchema = z
  .object({
    event_id: z.string().min(1, "event_id is required"),
    title: z.string().min(1).optional(),
    start: z.string().min(1).optional(),
    end: z.string().min(1).optional(),
    attendees: z.array(z.string().email()).max(100).optional(),
    description: z.string().max(8_000).optional(),
    location: z.string().max(1_000).optional(),
    timezone: z.string().min(1).optional(),
    calendar_id: z.string().min(1).optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.start !== undefined ||
      v.end !== undefined ||
      v.attendees !== undefined ||
      v.description !== undefined ||
      v.location !== undefined,
    { message: "update_event needs at least one field to change", path: ["event_id"] },
  );
export type UpdateEventInput = z.infer<typeof UpdateEventInputSchema>;

export function buildPatchBody(input: UpdateEventInput): EventWriteBody {
  const body: EventWriteBody = {};
  if (input.title !== undefined) body.summary = input.title;
  if (input.start !== undefined) body.start = toEventDateTime(input.start, input.timezone);
  if (input.end !== undefined) body.end = toEventDateTime(input.end, input.timezone);
  if (input.description !== undefined) body.description = input.description;
  if (input.location !== undefined) body.location = input.location;
  if (input.attendees !== undefined) {
    body.attendees = input.attendees.map((email) => ({ email }));
  }
  return body;
}

export function dryRunSummary(input: UpdateEventInput): string {
  const lines: string[] = [`Update event ${input.event_id}`];
  if (input.title !== undefined) lines.push(`Title → "${input.title}"`);
  if (input.start !== undefined || input.end !== undefined) {
    lines.push(`When → ${input.start ?? "(unchanged)"} → ${input.end ?? "(unchanged)"}`);
  }
  if (input.location !== undefined) lines.push(`Where → ${input.location}`);
  if (input.attendees !== undefined) {
    lines.push(
      input.attendees.length > 0
        ? `Attendees → ${humanList(input.attendees)} (they'll be re-notified).`
        : "Attendees → cleared.",
    );
  }
  if (input.description !== undefined) {
    const flat = input.description.replace(/\s+/g, " ").trim();
    lines.push("", flat.length > 280 ? `${flat.slice(0, 280).trimEnd()}…` : flat);
  }
  return lines.join("\n");
}

export type UpdateEventAuditFields = {
  connector: "calendar";
  action: "update_event";
  calendarId: string;
  eventId: string;
  changedFields: string[];
};

export function auditFields(input: UpdateEventInput): UpdateEventAuditFields {
  const changed: string[] = [];
  if (input.title !== undefined) changed.push("title");
  if (input.start !== undefined) changed.push("start");
  if (input.end !== undefined) changed.push("end");
  if (input.attendees !== undefined) changed.push("attendees");
  if (input.description !== undefined) changed.push("description");
  if (input.location !== undefined) changed.push("location");
  return {
    connector: "calendar",
    action: "update_event",
    calendarId: input.calendar_id ?? DEFAULT_CALENDAR,
    eventId: input.event_id,
    changedFields: changed,
  };
}

export async function execute(args: {
  accessToken: string;
  input: UpdateEventInput;
}): Promise<CalendarResult<{ eventId: string; htmlLink: string | null }>> {
  const body = buildPatchBody(args.input);
  const sendUpdates = args.input.attendees !== undefined;
  const result = await patchEvent(args.accessToken, {
    calendarId: args.input.calendar_id ?? DEFAULT_CALENDAR,
    eventId: args.input.event_id,
    body,
    sendUpdates,
  });
  if (!result.ok) return result;
  return { ok: true, data: { eventId: result.data.id, htmlLink: result.data.htmlLink ?? null } };
}

export const updateEventAction = {
  name: "calendar.update_event",
  connector: "calendar",
  action: "update_event",
  gate: "gated",
  description:
    "Change an existing event on the connected Google Calendar (time, title, location, " +
    "attendees, or description). Approval-gated: stages in the Inbox first; attendees are " +
    "re-notified only on approval.",
  inputSchema: UpdateEventInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
