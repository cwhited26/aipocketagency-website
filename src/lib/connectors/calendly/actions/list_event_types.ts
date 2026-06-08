// connector.calendly.list_event_types — read the owner's available meeting types.
//
// Read-only: bypasses the approval Inbox (task item 3). The orchestrator runtime / chat lane call
// this directly, and the /api/connections/calendly/event-types endpoint surfaces it to the app.
// These are the meeting types a prospect can book (e.g. "30 min intro call", "Site visit") —
// each one is what create_one_off_link points a single-use booking link at.
//
// Schema + dry-run are pure (no network/DB); only execute() touches the Calendly API.

import { z } from "zod";
import { listEventTypes } from "../api";
import type { CalendlyResult } from "../types";
import { projectEventType, type ProjectedEventType } from "../format";

const DEFAULT_COUNT = 25;

export const ListEventTypesInputSchema = z.object({
  count: z.number().int().min(1).max(100).optional(),
  // When true, drop inactive event types from the result (active types are the ones a prospect
  // can actually book).
  active_only: z.boolean().optional(),
});
export type ListEventTypesInput = z.infer<typeof ListEventTypesInputSchema>;

export function dryRunSummary(input: ListEventTypesInput): string {
  return `List up to ${input.count ?? DEFAULT_COUNT} Calendly meeting types${
    input.active_only ? " (active only)" : ""
  }.`;
}

export type ListEventTypesAuditFields = {
  connector: "calendly";
  action: "list_event_types";
  count: number;
  activeOnly: boolean;
};

export function auditFields(input: ListEventTypesInput): ListEventTypesAuditFields {
  return {
    connector: "calendly",
    action: "list_event_types",
    count: input.count ?? DEFAULT_COUNT,
    activeOnly: Boolean(input.active_only),
  };
}

export async function execute(args: {
  accessToken: string;
  userUri: string;
  input: ListEventTypesInput;
}): Promise<CalendlyResult<{ eventTypes: ProjectedEventType[] }>> {
  const result = await listEventTypes(args.accessToken, {
    userUri: args.userUri,
    count: args.input.count ?? DEFAULT_COUNT,
  });
  if (!result.ok) return result;
  let projected = result.data.map(projectEventType);
  if (args.input.active_only) projected = projected.filter((e) => e.active);
  return { ok: true, data: { eventTypes: projected } };
}

export const listEventTypesAction = {
  name: "calendly.list_event_types",
  connector: "calendly",
  action: "list_event_types",
  gate: "read",
  description:
    "List the owner's Calendly meeting types (e.g. '30 min intro call', 'Site visit') — what a " +
    "prospect can book. Read-only — runs without approval.",
  inputSchema: ListEventTypesInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
