// connector.calendly.list_invitees — see who booked a specific scheduled event.
//
// Read-only: bypasses the approval Inbox. Given a scheduled-event URI (from list_scheduled_events),
// returns the invitees — name, email, and status — so the owner can see who's coming to a booking
// and PA can follow up. Schema + dry-run are pure; only execute() touches the Calendly API.

import { z } from "zod";
import { listInvitees } from "../api";
import type { CalendlyResult } from "../types";
import { projectInvitee, uriId, type ProjectedInvitee } from "../format";

const DEFAULT_COUNT = 50;

export const ListInviteesInputSchema = z.object({
  // The scheduled-event resource URI (https://api.calendly.com/scheduled_events/<uuid>).
  event_uri: z.string().url("event_uri must be a Calendly scheduled-event URI"),
  count: z.number().int().min(1).max(100).optional(),
});
export type ListInviteesInput = z.infer<typeof ListInviteesInputSchema>;

export function dryRunSummary(input: ListInviteesInput): string {
  return `List up to ${input.count ?? DEFAULT_COUNT} invitees for booking ${uriId(input.event_uri)}.`;
}

export type ListInviteesAuditFields = {
  connector: "calendly";
  action: "list_invitees";
  eventUri: string;
  count: number;
};

export function auditFields(input: ListInviteesInput): ListInviteesAuditFields {
  return {
    connector: "calendly",
    action: "list_invitees",
    eventUri: input.event_uri,
    count: input.count ?? DEFAULT_COUNT,
  };
}

export async function execute(args: {
  accessToken: string;
  input: ListInviteesInput;
}): Promise<CalendlyResult<{ invitees: ProjectedInvitee[] }>> {
  const result = await listInvitees(args.accessToken, {
    eventUri: args.input.event_uri,
    count: args.input.count ?? DEFAULT_COUNT,
  });
  if (!result.ok) return result;
  return { ok: true, data: { invitees: result.data.map(projectInvitee) } };
}

export const listInviteesAction = {
  name: "calendly.list_invitees",
  connector: "calendly",
  action: "list_invitees",
  gate: "read",
  description:
    "See who booked a specific Calendly event — invitee names, emails, and status. Read-only — " +
    "runs without approval.",
  inputSchema: ListInviteesInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
