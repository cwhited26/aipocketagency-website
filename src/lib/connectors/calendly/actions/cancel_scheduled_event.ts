// connector.calendly.cancel_scheduled_event — cancel a booking a prospect already made.
//
// Write action — approval-gated, and the most socially costly of the set: canceling notifies the
// prospect who booked, so it stays gated far longer than create_one_off_link (trust window 25 vs
// 10 — see tier-caps CONNECTOR_ACTION_TRUST_OVERRIDES). The dry-run makes the prospect-facing
// notice explicit. Schema + dry-run are pure; only execute() touches the Calendly API.

import { z } from "zod";
import { cancelScheduledEvent } from "../api";
import type { CalendlyResult } from "../types";
import { uriId } from "../format";

export const CancelScheduledEventInputSchema = z.object({
  // The scheduled-event resource URI (https://api.calendly.com/scheduled_events/<uuid>).
  event_uri: z.string().url("event_uri must be a Calendly scheduled-event URI"),
  reason: z.string().max(1_000).optional(),
});
export type CancelScheduledEventInput = z.infer<typeof CancelScheduledEventInputSchema>;

export function dryRunSummary(input: CancelScheduledEventInput): string {
  return [
    `Cancel Calendly booking ${uriId(input.event_uri)}`,
    input.reason ? `Reason: ${input.reason}` : "No reason given.",
    "The prospect who booked receives a cancellation notice. This can't be undone from here.",
  ].join("\n");
}

export type CancelScheduledEventAuditFields = {
  connector: "calendly";
  action: "cancel_scheduled_event";
  eventUri: string;
  hasReason: boolean;
};

export function auditFields(input: CancelScheduledEventInput): CancelScheduledEventAuditFields {
  return {
    connector: "calendly",
    action: "cancel_scheduled_event",
    eventUri: input.event_uri,
    hasReason: Boolean(input.reason),
  };
}

export async function execute(args: {
  accessToken: string;
  input: CancelScheduledEventInput;
}): Promise<CalendlyResult<{ eventUri: string; reason: string | null }>> {
  const result = await cancelScheduledEvent(args.accessToken, {
    eventUri: args.input.event_uri,
    reason: args.input.reason,
  });
  if (!result.ok) return result;
  return { ok: true, data: { eventUri: args.input.event_uri, reason: result.data.reason } };
}

export const cancelScheduledEventAction = {
  name: "calendly.cancel_scheduled_event",
  connector: "calendly",
  action: "cancel_scheduled_event",
  gate: "gated",
  description:
    "Cancel a Calendly booking a prospect already made, notifying them. Approval-gated: stages in " +
    "the Inbox first; the cancellation sends only on approval.",
  inputSchema: CancelScheduledEventInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
