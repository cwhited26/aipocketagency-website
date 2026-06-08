// connector.zoom.cancel_meeting — cancel an existing Zoom meeting and notify attendees.
//
// Write action — approval-gated with a TIGHTENED trust window (task item 8): it removes a meeting
// already on the books and emails attendees, so it stays gated longer than create_meeting (see
// tier-caps.ts CONNECTOR_ACTION_TRUST_OVERRIDES → zoom:cancel_meeting). Stages in the Inbox; fires
// on approval.
//
// Pure schema/dry-run; only execute() touches the Zoom API (a 204 No Content DELETE). Cancellation
// notifies attendees by default (cancel_meeting_reminder=true) — the socially correct default.

import { z } from "zod";
import { deleteMeeting, type ZoomApiResult } from "../api";
import { meetingIdToPath } from "../format";

export const CancelMeetingInputSchema = z.object({
  meeting_id: z.union([z.string().min(1), z.number()]),
  // Default true: attendees are emailed that the meeting was canceled.
  notify_attendees: z.boolean().optional(),
});
export type CancelMeetingInput = z.infer<typeof CancelMeetingInputSchema>;

export function dryRunSummary(input: CancelMeetingInput): string {
  const notify = input.notify_attendees ?? true;
  return [
    `Cancel Zoom meeting ${String(input.meeting_id)}`,
    notify ? "Attendees will be emailed that it's canceled." : "Attendees will NOT be notified.",
  ].join("\n");
}

export async function execute(args: {
  accessToken: string;
  input: CancelMeetingInput;
}): Promise<ZoomApiResult<{ meetingId: string }>> {
  const id = meetingIdToPath(args.input.meeting_id);
  if (!id) return { ok: false, status: 422, error: "meeting_id is required.", authError: false };
  const result = await deleteMeeting(args.accessToken, {
    meetingId: id,
    notifyAttendees: args.input.notify_attendees ?? true,
  });
  if (!result.ok) return result;
  return { ok: true, data: { meetingId: id } };
}

export const cancelMeetingAction = {
  name: "zoom.cancel_meeting",
  connector: "zoom",
  action: "cancel_meeting",
  gate: "gated",
  description:
    "Cancel an existing Zoom meeting and (by default) email attendees that it's canceled. " +
    "Approval-gated (stays gated longer than create): stages in the Inbox; the meeting is canceled " +
    "on approval.",
  inputSchema: CancelMeetingInputSchema,
  dryRunSummary,
  execute,
} as const;
