// connector.calendly.list_scheduled_events — read what's actually booked on Calendly.
//
// Read-only: bypasses the approval Inbox. Surfaces upcoming (or canceled) bookings — the
// prospect-facing side of the owner's time, distinct from Google Calendar's personal schedule.
// Powers the Calendar tab's merged timeline (Google Calendar + Calendly) alongside list_events.
//
// Calendly scopes scheduled_events by (user, organization); the org URI is resolved from the
// stored user URI by the connector (getUserOrganization) and passed in here — so this action
// stays pure-ish (only execute() touches the API). Schema + dry-run are pure.

import { z } from "zod";
import { listScheduledEvents } from "../api";
import type { CalendlyResult } from "../types";
import { projectScheduledEvent, type ProjectedScheduledEvent } from "../format";

const DEFAULT_COUNT = 20;
const DEFAULT_WINDOW_DAYS = 30;

export const ListScheduledEventsInputSchema = z.object({
  // RFC 3339 lower/upper bounds on start_time. Default: now → now + 30 days.
  min_start_time: z.string().min(1).optional(),
  max_start_time: z.string().min(1).optional(),
  count: z.number().int().min(1).max(100).optional(),
  status: z.enum(["active", "canceled"]).optional(),
});
export type ListScheduledEventsInput = z.infer<typeof ListScheduledEventsInputSchema>;

function resolveWindow(input: ListScheduledEventsInput): { minStartTime: string; maxStartTime: string } {
  const now = Date.now();
  const minStartTime = input.min_start_time ?? new Date(now).toISOString();
  const maxStartTime =
    input.max_start_time ?? new Date(now + DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return { minStartTime, maxStartTime };
}

export function dryRunSummary(input: ListScheduledEventsInput): string {
  const { minStartTime, maxStartTime } = resolveWindow(input);
  return `List up to ${input.count ?? DEFAULT_COUNT} ${
    input.status ?? "active"
  } Calendly bookings between ${minStartTime} and ${maxStartTime}.`;
}

export type ListScheduledEventsAuditFields = {
  connector: "calendly";
  action: "list_scheduled_events";
  minStartTime: string;
  maxStartTime: string;
  status: string;
};

export function auditFields(input: ListScheduledEventsInput): ListScheduledEventsAuditFields {
  const { minStartTime, maxStartTime } = resolveWindow(input);
  return {
    connector: "calendly",
    action: "list_scheduled_events",
    minStartTime,
    maxStartTime,
    status: input.status ?? "active",
  };
}

export async function execute(args: {
  accessToken: string;
  userUri: string;
  organizationUri: string;
  input: ListScheduledEventsInput;
}): Promise<CalendlyResult<{ events: ProjectedScheduledEvent[] }>> {
  const { minStartTime, maxStartTime } = resolveWindow(args.input);
  const result = await listScheduledEvents(args.accessToken, {
    userUri: args.userUri,
    organizationUri: args.organizationUri,
    count: args.input.count ?? DEFAULT_COUNT,
    status: args.input.status,
    minStartTime,
    maxStartTime,
  });
  if (!result.ok) return result;
  return { ok: true, data: { events: result.data.map(projectScheduledEvent) } };
}

export const listScheduledEventsAction = {
  name: "calendly.list_scheduled_events",
  connector: "calendly",
  action: "list_scheduled_events",
  gate: "read",
  description:
    "List what's actually booked on the owner's Calendly within a time window (who's coming, " +
    "when). Read-only — runs without approval.",
  inputSchema: ListScheduledEventsInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
