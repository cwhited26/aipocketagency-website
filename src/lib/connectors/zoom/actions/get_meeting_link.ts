// connector.zoom.get_meeting_link — return the join_url for a specific Zoom meeting.
//
// Read-only: bypasses the approval Inbox (task item 8). Auto-approve eligible from day one. This is
// the action the drafter calls when it needs a join link to drop into an outbound email or a
// calendar event description (cross-connector composition — see compose.ts + system-prompt.ts).

import { z } from "zod";
import { getMeeting } from "../api";
import type { ZoomApiResult } from "../api";
import { meetingIdToPath } from "../format";

export const GetMeetingLinkInputSchema = z.object({
  // Zoom meeting ids are long numerics; accept a number or string.
  meeting_id: z.union([z.string().min(1), z.number()]),
});
export type GetMeetingLinkInput = z.infer<typeof GetMeetingLinkInputSchema>;

export function dryRunSummary(input: GetMeetingLinkInput): string {
  return `Look up the join link for Zoom meeting ${String(input.meeting_id)}.`;
}

export async function execute(args: {
  accessToken: string;
  input: GetMeetingLinkInput;
}): Promise<ZoomApiResult<{ meetingId: string; topic: string | null; joinUrl: string | null; start: string | null }>> {
  const id = meetingIdToPath(args.input.meeting_id);
  if (!id) return { ok: false, status: 422, error: "meeting_id is required.", authError: false };
  const result = await getMeeting(args.accessToken, id);
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      meetingId: result.data.id,
      topic: result.data.topic ?? null,
      joinUrl: result.data.join_url ?? null,
      start: result.data.start_time ?? null,
    },
  };
}

export const getMeetingLinkAction = {
  name: "zoom.get_meeting_link",
  connector: "zoom",
  action: "get_meeting_link",
  gate: "read",
  description:
    "Return the join link (join_url) for a specific Zoom meeting by id — useful when drafting an " +
    "outbound email or calendar invite that needs the link. Read-only — runs without approval.",
  inputSchema: GetMeetingLinkInputSchema,
  dryRunSummary,
  execute,
} as const;
