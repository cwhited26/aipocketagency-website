// connector.calendar.propose_times — suggest open meeting slots from free/busy.
//
// Draft-only (task items 5–6): reads free/busy across the owner's calendar (and any attendees'
// calendars the API can see) and returns candidate open slots. It NEVER writes to the calendar,
// so it's auto-approve eligible by default — the owner picks a slot, which then flows into
// create_event (the gated write). Always run this before create_event when the time isn't
// explicit in the request (Roadmap §2.2 drafter behavior).
//
// The slot math (computeOpenSlots) is pure + deterministic — no Date.now()/random inside — so
// it's unit-testable; only execute() reads free/busy over the network.

import { z } from "zod";
import { freeBusy } from "../api";
import type { CalendarResult } from "../oauth";

const DEFAULT_CALENDAR = "primary";
const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_WORK_START_HOUR = 9;
const DEFAULT_WORK_END_HOUR = 17;
const DEFAULT_MAX_SUGGESTIONS = 3;
const GRID_MINUTES = 30; // candidate slots align to :00 / :30 in local time

export const ProposeTimesInputSchema = z.object({
  duration_minutes: z.number().int().min(5).max(480),
  // RFC 3339 bounds for the search window. Default: now → now + 7 days.
  window_start: z.string().min(1).optional(),
  window_end: z.string().min(1).optional(),
  // Attendee emails whose calendars are also checked for conflicts (best-effort — only
  // calendars the connected account can see contribute busy blocks).
  attendees: z.array(z.string().email()).max(50).optional(),
  // Working-hour bounds (local clock hours, 0–24). end must be after start.
  work_start_hour: z.number().int().min(0).max(23).optional(),
  work_end_hour: z.number().int().min(1).max(24).optional(),
  // Minutes east of UTC for interpreting working hours (the drafter supplies the owner's
  // profile offset). Default 0 (UTC). Avoids a timezone-db dependency while staying deterministic.
  tz_offset_minutes: z.number().int().min(-840).max(840).optional(),
  include_weekends: z.boolean().optional(),
  max_suggestions: z.number().int().min(1).max(10).optional(),
  calendar_id: z.string().min(1).optional(),
});
export type ProposeTimesInput = z.infer<typeof ProposeTimesInputSchema>;

export type ProposedSlot = { start: string; end: string };

function resolveWindow(input: ProposeTimesInput): { startMs: number; endMs: number } {
  const now = Date.now();
  const startMs = input.window_start ? Date.parse(input.window_start) : now;
  const endMs = input.window_end
    ? Date.parse(input.window_end)
    : now + DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

/**
 * Pure open-slot finder. Walks the window on a 30-minute grid, keeping candidate slots that
 * (a) fall entirely inside working hours on a working day (local time via tzOffsetMinutes),
 * and (b) don't overlap any busy interval. Returns up to maxSuggestions slots, earliest first.
 */
export function computeOpenSlots(args: {
  windowStartMs: number;
  windowEndMs: number;
  durationMinutes: number;
  workStartHour: number;
  workEndHour: number;
  tzOffsetMinutes: number;
  includeWeekends: boolean;
  busy: { start: string; end: string }[];
  maxSuggestions: number;
}): ProposedSlot[] {
  const durationMs = args.durationMinutes * 60_000;
  const gridMs = GRID_MINUTES * 60_000;
  const offsetMs = args.tzOffsetMinutes * 60_000;

  const busy: Array<[number, number]> = args.busy
    .map((b) => [Date.parse(b.start), Date.parse(b.end)] as [number, number])
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .sort((a, b) => a[0] - b[0]);

  const overlapsBusy = (start: number, end: number): boolean =>
    busy.some(([bs, be]) => start < be && end > bs);

  // First candidate: round the window start UP to the next grid boundary.
  let cursor = Math.ceil(args.windowStartMs / gridMs) * gridMs;
  const slots: ProposedSlot[] = [];

  // Bound the loop so a huge window can never spin unbounded.
  const maxIterations = 4_000;
  let iterations = 0;

  while (cursor + durationMs <= args.windowEndMs && slots.length < args.maxSuggestions) {
    if (iterations++ > maxIterations) break;
    const slotStart = cursor;
    const slotEnd = cursor + durationMs;

    // Local-clock view of the slot (shift by the offset, then read UTC parts).
    const localStart = new Date(slotStart + offsetMs);
    const localEnd = new Date(slotEnd + offsetMs);
    const day = localStart.getUTCDay(); // 0 = Sun … 6 = Sat
    const startHour = localStart.getUTCHours() + localStart.getUTCMinutes() / 60;
    const endHour = localEnd.getUTCHours() + localEnd.getUTCMinutes() / 60;

    const isWorkingDay = args.includeWeekends || (day !== 0 && day !== 6);
    // The slot must start and end within working hours on the SAME local day.
    const sameLocalDay = localStart.getUTCDate() === localEnd.getUTCDate();
    const withinHours =
      startHour >= args.workStartHour &&
      (endHour <= args.workEndHour || (endHour === 0 && args.workEndHour === 24));

    if (isWorkingDay && sameLocalDay && withinHours && !overlapsBusy(slotStart, slotEnd)) {
      slots.push({
        start: new Date(slotStart).toISOString(),
        end: new Date(slotEnd).toISOString(),
      });
    }
    cursor += gridMs;
  }
  return slots;
}

export function dryRunSummary(input: ProposeTimesInput): string {
  const { startMs, endMs } = resolveWindow(input);
  const n = input.max_suggestions ?? DEFAULT_MAX_SUGGESTIONS;
  return (
    `Find up to ${n} open ${input.duration_minutes}-minute slots between ` +
    `${new Date(startMs).toISOString()} and ${new Date(endMs).toISOString()}. ` +
    "Reads free/busy only — nothing is scheduled until you pick a slot."
  );
}

export type ProposeTimesAuditFields = {
  connector: "calendar";
  action: "propose_times";
  calendarId: string;
  durationMinutes: number;
  attendeeCount: number;
};

export function auditFields(input: ProposeTimesInput): ProposeTimesAuditFields {
  return {
    connector: "calendar",
    action: "propose_times",
    calendarId: input.calendar_id ?? DEFAULT_CALENDAR,
    durationMinutes: input.duration_minutes,
    attendeeCount: input.attendees?.length ?? 0,
  };
}

export async function execute(args: {
  accessToken: string;
  input: ProposeTimesInput;
}): Promise<CalendarResult<{ slots: ProposedSlot[] }>> {
  const { startMs, endMs } = resolveWindow(args.input);
  const calendarIds = [
    args.input.calendar_id ?? DEFAULT_CALENDAR,
    ...(args.input.attendees ?? []),
  ];

  const fb = await freeBusy(args.accessToken, {
    calendarIds,
    timeMin: new Date(startMs).toISOString(),
    timeMax: new Date(endMs).toISOString(),
  });
  if (!fb.ok) return fb;

  const busy: { start: string; end: string }[] = [];
  for (const cal of Object.values(fb.data.calendars)) {
    for (const b of cal.busy ?? []) busy.push(b);
  }

  const slots = computeOpenSlots({
    windowStartMs: startMs,
    windowEndMs: endMs,
    durationMinutes: args.input.duration_minutes,
    workStartHour: args.input.work_start_hour ?? DEFAULT_WORK_START_HOUR,
    workEndHour: args.input.work_end_hour ?? DEFAULT_WORK_END_HOUR,
    tzOffsetMinutes: args.input.tz_offset_minutes ?? 0,
    includeWeekends: args.input.include_weekends ?? false,
    busy,
    maxSuggestions: args.input.max_suggestions ?? DEFAULT_MAX_SUGGESTIONS,
  });

  return { ok: true, data: { slots } };
}

export const proposeTimesAction = {
  name: "calendar.propose_times",
  connector: "calendar",
  action: "propose_times",
  gate: "auto",
  description:
    "Suggest open meeting slots by reading free/busy across the owner's (and attendees') " +
    "calendars. Read + draft only — schedules nothing — so it's auto-approve eligible.",
  inputSchema: ProposeTimesInputSchema,
  dryRunSummary,
  auditFields,
  execute,
} as const;
