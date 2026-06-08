// connector.zoom.list_upcoming_meetings — read the owner's upcoming Zoom meetings.
//
// Read-only: bypasses the approval Inbox (task item 8). Auto-approve eligible from day one. The
// orchestrator runtime + the /api/connections/zoom/data endpoint call this directly.

import { z } from "zod";
import { listMeetings, type ZoomMeeting } from "../api";
import type { ZoomApiResult } from "../api";

const DEFAULT_PAGE_SIZE = 10;

export const ListUpcomingMeetingsInputSchema = z.object({
  page_size: z.number().int().min(1).max(100).optional(),
});
export type ListUpcomingMeetingsInput = z.infer<typeof ListUpcomingMeetingsInputSchema>;

export function dryRunSummary(input: ListUpcomingMeetingsInput): string {
  return `List up to ${input.page_size ?? DEFAULT_PAGE_SIZE} upcoming Zoom meetings.`;
}

// Slim, UI-safe projection of a meeting.
export type ListedMeeting = {
  id: string;
  topic: string;
  start: string;
  durationMinutes: number | null;
  joinUrl: string | null;
};

function project(m: ZoomMeeting): ListedMeeting {
  return {
    id: m.id,
    topic: m.topic ?? "(no topic)",
    start: m.start_time ?? "—",
    durationMinutes: typeof m.duration === "number" ? m.duration : null,
    joinUrl: m.join_url ?? null,
  };
}

export async function execute(args: {
  accessToken: string;
  zoomUserId: string;
  input: ListUpcomingMeetingsInput;
}): Promise<ZoomApiResult<{ meetings: ListedMeeting[] }>> {
  const result = await listMeetings(args.accessToken, {
    userId: args.zoomUserId,
    type: "upcoming",
    pageSize: args.input.page_size ?? DEFAULT_PAGE_SIZE,
  });
  if (!result.ok) return result;
  return { ok: true, data: { meetings: result.data.map(project) } };
}

export const listUpcomingMeetingsAction = {
  name: "zoom.list_upcoming_meetings",
  connector: "zoom",
  action: "list_upcoming_meetings",
  gate: "read",
  description:
    "List the owner's upcoming Zoom meetings (topic / start time / join link). Read-only — never " +
    "writes, so it runs without approval.",
  inputSchema: ListUpcomingMeetingsInputSchema,
  dryRunSummary,
  execute,
} as const;
