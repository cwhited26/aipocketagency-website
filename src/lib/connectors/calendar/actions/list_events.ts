// connector.calendar.list_events — read upcoming events from the connected calendar.
//
// Read-only: bypasses the approval Inbox (task item 5). The orchestrator runtime calls this
// directly, and the /api/connections/calendar/events endpoint surfaces it to the app.
//
// Action shape mirrors the Gmail connector: name, description, input schema (Zod),
// dryRunSummary, auditFields, execute. The schema + dry-run are pure (no network/DB).

import { z } from "zod";
import { listEvents, type EventResource } from "../api";
import type { CalendarResult } from "../oauth";
import { whenLabel } from "../format";

const DEFAULT_CALENDAR = "primary";
const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_WINDOW_DAYS = 7;

export const ListEventsInputSchema = z.object({
  // RFC 3339 lower/upper bounds. Default: now → now + 7 days.
  time_min: z.string().min(1).optional(),
  time_max: z.string().min(1).optional(),
  max_results: z.number().int().min(1).max(250).optional(),
  calendar_id: z.string().min(1).optional(),
});
export type ListEventsInput = z.infer<typeof ListEventsInputSchema>;

function resolveWindow(input: ListEventsInput): { timeMin: string; timeMax: string } {
  const now = Date.now();
  const timeMin = input.time_min ?? new Date(now).toISOString();
  const timeMax =
    input.time_max ?? new Date(now + DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return { timeMin, timeMax };
}

export function dryRunSummary(input: ListEventsInput): string {
  const { timeMin, timeMax } = resolveWindow(input);
  const max = input.max_results ?? DEFAULT_MAX_RESULTS;
  return `List up to ${max} events on ${input.calendar_id ?? DEFAULT_CALENDAR} between ${timeMin} and ${timeMax}.`;
}

export type ListEventsAuditFields = {
  connector: "calendar";
  action: "list_events";
  calendarId: string;
  timeMin: string;
  timeMax: string;
};

export function auditFields(input: ListEventsInput): ListEventsAuditFields {
  const { timeMin, timeMax } = resolveWindow(input);
  return {
    connector: "calendar",
    action: "list_events",
    calendarId: input.calendar_id ?? DEFAULT_CALENDAR,
    timeMin,
    timeMax,
  };
}

// Slim, UI-safe projection of an event.
export type ListedEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string | null;
  htmlLink: string | null;
  attendees: string[];
};

function project(e: EventResource): ListedEvent {
  return {
    id: e.id,
    summary: e.summary ?? "(no title)",
    start: whenLabel(e.start),
    end: whenLabel(e.end),
    location: e.location ?? null,
    htmlLink: e.htmlLink ?? null,
    attendees: (e.attendees ?? []).map((a) => a.email ?? "").filter(Boolean),
  };
}

export async function execute(args: {
  accessToken: string;
  input: ListEventsInput;
}): Promise<CalendarResult<{ events: ListedEvent[] }>> {
  const { timeMin, timeMax } = resolveWindow(args.input);
  const result = await listEvents(args.accessToken, {
    calendarId: args.input.calendar_id ?? DEFAULT_CALENDAR,
    timeMin,
    timeMax,
    maxResults: args.input.max_results ?? DEFAULT_MAX_RESULTS,
  });
  if (!result.ok) return result;
  return { ok: true, data: { events: result.data.map(project) } };
}

export const listEventsAction = {
  name: "calendar.list_events",
  connector: "calendar",
  action: "list_events",
  gate: "read",
  description:
    "Read upcoming events from the connected Google Calendar within a time window. Read-only — " +
    "never writes, so it runs without approval.",
  inputSchema: ListEventsInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
