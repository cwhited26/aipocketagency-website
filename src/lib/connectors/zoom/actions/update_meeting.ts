// connector.zoom.update_meeting — change an existing Zoom meeting (reschedule, retitle, etc.).
//
// Write action — approval-gated with a TIGHTENED trust window (task item 8): it touches a meeting
// already on the books, so it stays gated longer than create_meeting (see tier-caps.ts
// CONNECTOR_ACTION_TRUST_OVERRIDES → zoom:update_meeting). Stages in the Inbox; fires on approval.
//
// Pure schema/dry-run/body builder; only execute() touches the Zoom API (a 204 No Content PATCH).

import { z } from "zod";
import { updateMeeting, type MeetingWriteBody, type ZoomApiResult } from "../api";
import { durationMinutes, meetingIdToPath } from "../format";

export const UpdateMeetingInputSchema = z
  .object({
    meeting_id: z.union([z.string().min(1), z.number()]),
    topic: z.string().min(1).max(200).optional(),
    start_time: z.string().min(1).optional(),
    duration_minutes: z.number().int().min(1).max(1_440).optional(),
    end_time: z.string().min(1).optional(),
    timezone: z.string().min(1).optional(),
    agenda: z.string().max(2_000).optional(),
    auto_recording: z.enum(["none", "local", "cloud"]).optional(),
  })
  .refine(
    (v) =>
      v.topic !== undefined ||
      v.start_time !== undefined ||
      v.duration_minutes !== undefined ||
      v.end_time !== undefined ||
      v.timezone !== undefined ||
      v.agenda !== undefined ||
      v.auto_recording !== undefined,
    { message: "at least one field to change is required" },
  );
export type UpdateMeetingInput = z.infer<typeof UpdateMeetingInputSchema>;

export function buildUpdateBody(input: UpdateMeetingInput): MeetingWriteBody {
  const body: MeetingWriteBody = {};
  if (input.topic !== undefined) body.topic = input.topic;
  if (input.start_time !== undefined) body.start_time = input.start_time;
  if (input.duration_minutes !== undefined) {
    body.duration = input.duration_minutes;
  } else if (input.start_time !== undefined && input.end_time !== undefined) {
    const derived = durationMinutes(input.start_time, input.end_time);
    if (derived !== null) body.duration = derived;
  }
  if (input.timezone !== undefined) body.timezone = input.timezone;
  if (input.agenda !== undefined) body.agenda = input.agenda;
  if (input.auto_recording !== undefined) body.settings = { auto_recording: input.auto_recording };
  return body;
}

export function dryRunSummary(input: UpdateMeetingInput): string {
  const lines: string[] = [`Update Zoom meeting ${String(input.meeting_id)}`];
  if (input.topic !== undefined) lines.push(`Topic → ${input.topic}`);
  if (input.start_time !== undefined) lines.push(`Start → ${input.start_time}`);
  if (input.duration_minutes !== undefined) lines.push(`Duration → ${input.duration_minutes} min`);
  if (input.timezone !== undefined) lines.push(`Timezone → ${input.timezone}`);
  if (input.auto_recording !== undefined) lines.push(`Auto-recording → ${input.auto_recording}`);
  lines.push("Attendees see the updated details.");
  return lines.join("\n");
}

export async function execute(args: {
  accessToken: string;
  input: UpdateMeetingInput;
}): Promise<ZoomApiResult<{ meetingId: string }>> {
  const id = meetingIdToPath(args.input.meeting_id);
  if (!id) return { ok: false, status: 422, error: "meeting_id is required.", authError: false };
  const result = await updateMeeting(args.accessToken, { meetingId: id, body: buildUpdateBody(args.input) });
  if (!result.ok) return result;
  return { ok: true, data: { meetingId: id } };
}

export const updateMeetingAction = {
  name: "zoom.update_meeting",
  connector: "zoom",
  action: "update_meeting",
  gate: "gated",
  description:
    "Change an existing Zoom meeting — reschedule the time, rename, or adjust duration/recording. " +
    "Approval-gated (stays gated longer than create): stages in the Inbox; the change applies on " +
    "approval and attendees see the update.",
  inputSchema: UpdateMeetingInputSchema,
  dryRunSummary,
  execute,
} as const;
