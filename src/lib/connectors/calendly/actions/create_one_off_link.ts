// connector.calendly.create_one_off_link — generate a single-use booking link for one meeting type.
//
// Write action — approval-gated (task items 8–9): a sub-agent stages this in the Inbox; it fires
// only after the owner approves (or once the trust window unlocks auto-approve at N=10). This is
// the low-risk write in the set — it only mints a link; nothing happens in the real world until a
// prospect actually books through it. That's why its trust window is the default 10, not the
// hard-tightened bar the money connectors carry.
//
// On Calendly's API a one-off link is a "scheduling link" owned by an EventType, with
// max_event_count controlling how many times it can be booked (1 = truly single-use). NOTE: the
// scheduling-links API does NOT accept a custom time window — the bookable window comes from the
// chosen event type's own availability rules, so there's deliberately no window param here (adding
// one would be dead input the API ignores). To narrow availability, the owner adjusts the event
// type in Calendly; PA picks the right event type for the meeting instead.
//
// Schema + dry-run + request shape are pure; only execute() touches the Calendly API.

import { z } from "zod";
import { createSchedulingLink } from "../api";
import type { CalendlyResult } from "../types";
import { uriId } from "../format";

const DEFAULT_MAX_EVENT_COUNT = 1;

export const CreateOneOffLinkInputSchema = z.object({
  // The event-type resource URI the link points at (from list_event_types).
  event_type_uri: z.string().url("event_type_uri must be a Calendly event-type URI"),
  // How many times the link can be booked. Defaults to 1 (single-use). Calendly caps this per
  // plan; keep it small for a true one-off.
  max_event_count: z.number().int().min(1).max(20).optional(),
  // Display name for the meeting type, for a clearer approval card (optional; resolved upstream
  // from a list_event_types match). Not sent to Calendly.
  event_type_name: z.string().max(200).optional(),
});
export type CreateOneOffLinkInput = z.infer<typeof CreateOneOffLinkInputSchema>;

export function dryRunSummary(input: CreateOneOffLinkInput): string {
  const which = input.event_type_name ?? uriId(input.event_type_uri);
  const max = input.max_event_count ?? DEFAULT_MAX_EVENT_COUNT;
  const lines = [
    `Create a Calendly booking link for "${which}"`,
    max === 1 ? "Single-use — expires after one booking." : `Bookable up to ${max} times.`,
    "The prospect picks a time from this meeting type's availability.",
  ];
  return lines.join("\n");
}

export type CreateOneOffLinkAuditFields = {
  connector: "calendly";
  action: "create_one_off_link";
  eventTypeUri: string;
  maxEventCount: number;
};

export function auditFields(input: CreateOneOffLinkInput): CreateOneOffLinkAuditFields {
  return {
    connector: "calendly",
    action: "create_one_off_link",
    eventTypeUri: input.event_type_uri,
    maxEventCount: input.max_event_count ?? DEFAULT_MAX_EVENT_COUNT,
  };
}

export async function execute(args: {
  accessToken: string;
  input: CreateOneOffLinkInput;
}): Promise<CalendlyResult<{ bookingUrl: string }>> {
  const result = await createSchedulingLink(args.accessToken, {
    eventTypeUri: args.input.event_type_uri,
    maxEventCount: args.input.max_event_count ?? DEFAULT_MAX_EVENT_COUNT,
  });
  if (!result.ok) return result;
  return { ok: true, data: { bookingUrl: result.data.bookingUrl } };
}

export const createOneOffLinkAction = {
  name: "calendly.create_one_off_link",
  connector: "calendly",
  action: "create_one_off_link",
  gate: "gated",
  description:
    "Generate a single-use Calendly booking link for a specific meeting type — what you send a " +
    "prospect so they can self-book. Approval-gated: stages in the Inbox first; the link is " +
    "minted only on approval (nothing happens out there until a prospect books through it).",
  inputSchema: CreateOneOffLinkInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
