// connector.zoom.create_meeting — schedule a new Zoom meeting on the owner's account.
//
// Write action — approval-gated (task items 7–8): a sub-agent stages it in the Inbox; it fires only
// after the owner approves (or once the default trust window unlocks auto-approve). It graduates at
// the standard window (N=10) because generating a Zoom link has no real-world side effect until
// someone actually joins — the lowest-risk write in the set.
//
// MIME-free: the schema, dry-run, and request-body builder are pure (no network/DB); only execute()
// touches the Zoom API. Duration is taken explicitly OR derived from start/end (format.ts).

import { z } from "zod";
import { createMeeting, type MeetingWriteBody, type ZoomApiResult } from "../api";
import { durationMinutes } from "../format";

const DEFAULT_DURATION_MINUTES = 30;

export const CreateMeetingInputSchema = z
  .object({
    topic: z.string().min(1, "topic is required").max(200),
    // ISO 8601 start, e.g. 2026-06-12T15:00:00Z.
    start_time: z.string().min(1, "start_time is required"),
    // Either an explicit duration, or an end_time the duration is derived from.
    duration_minutes: z.number().int().min(1).max(1_440).optional(),
    end_time: z.string().min(1).optional(),
    timezone: z.string().min(1).optional(),
    agenda: z.string().max(2_000).optional(),
    auto_recording: z.enum(["none", "local", "cloud"]).optional(),
  })
  .refine((v) => v.duration_minutes !== undefined || v.end_time !== undefined, {
    message: "either duration_minutes or end_time is required",
  });
export type CreateMeetingInput = z.infer<typeof CreateMeetingInputSchema>;

/** Resolve the meeting length (minutes) from an explicit duration or a start/end pair. */
export function resolveDuration(input: CreateMeetingInput): number {
  if (typeof input.duration_minutes === "number") return input.duration_minutes;
  if (input.end_time) {
    const derived = durationMinutes(input.start_time, input.end_time);
    if (derived !== null) return derived;
  }
  return DEFAULT_DURATION_MINUTES;
}

export function buildMeetingBody(input: CreateMeetingInput): MeetingWriteBody {
  const body: MeetingWriteBody = {
    topic: input.topic,
    type: 2, // scheduled meeting
    start_time: input.start_time,
    duration: resolveDuration(input),
  };
  if (input.timezone) body.timezone = input.timezone;
  if (input.agenda) body.agenda = input.agenda;
  if (input.auto_recording) body.settings = { auto_recording: input.auto_recording };
  return body;
}

export function dryRunSummary(input: CreateMeetingInput): string {
  const lines: string[] = [];
  lines.push(`Create Zoom meeting "${input.topic}"`);
  lines.push(
    `When: ${input.start_time} for ${resolveDuration(input)} min${
      input.timezone ? ` (${input.timezone})` : ""
    }`,
  );
  if (input.auto_recording && input.auto_recording !== "none") {
    lines.push(`Auto-recording: ${input.auto_recording}.`);
  }
  if (input.agenda) {
    const flat = input.agenda.replace(/\s+/g, " ").trim();
    lines.push("", flat.length > 280 ? `${flat.slice(0, 280).trimEnd()}…` : flat);
  }
  lines.push("Creates a join link — no one is notified until you share it.");
  return lines.join("\n");
}

export async function execute(args: {
  accessToken: string;
  zoomUserId: string;
  input: CreateMeetingInput;
}): Promise<ZoomApiResult<{ meetingId: string; joinUrl: string | null; startUrl: string | null }>> {
  const result = await createMeeting(args.accessToken, {
    userId: args.zoomUserId,
    body: buildMeetingBody(args.input),
  });
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      meetingId: result.data.id,
      joinUrl: result.data.join_url ?? null,
      startUrl: result.data.start_url ?? null,
    },
  };
}

export const createMeetingAction = {
  name: "zoom.create_meeting",
  connector: "zoom",
  action: "create_meeting",
  gate: "gated",
  description:
    "Schedule a new Zoom meeting (topic + start time + duration + optional agenda + auto-recording) " +
    "and return its join link. Approval-gated: stages in the Inbox first; the meeting is created on " +
    "approval.",
  inputSchema: CreateMeetingInputSchema,
  dryRunSummary,
  execute,
} as const;
