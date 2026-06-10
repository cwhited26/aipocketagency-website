// calendar-invite-template.ts — the Implementation Call invite for a purchased Setup Sprint (PA-SPRINT-1).
//
// When an owner buys the Done-With-You Setup, the operator schedules an Implementation Call: 60 minutes
// for Standard, 90 for Premium. This module builds the invite content three ways so the operator can use
// whichever channel fits: a Calendly booking line (the owner picks a time), a Google Calendar "add event"
// URL (pre-filled title/details/duration), and an .ics file body (for a fixed time). Pure — no I/O — so
// it's unit-tested and reused by the email send and the dashboard.

export type SprintTier = "standard" | "premium";

export function callDurationMinutes(tier: SprintTier): number {
  return tier === "premium" ? 90 : 60;
}

const CALL_TITLE = "Pocket Agent — AI Office Setup Sprint: Implementation Call";

function callDescription(tier: SprintTier): string {
  const base =
    "We build your AI Office together: your Business Brain from your real business, your Personas configured to your jobs, and your first workflow running. Come with your existing writing for voice, your customer list, your pricing, and the workflows you want set up first.";
  return tier === "premium"
    ? `${base} Premium also covers connecting Gmail/Calendar, a first Lead Scout run, your first daily and weekly brief, and a first Follow-Up Sweep — plus a 30-day check-in.`
    : base;
}

/** The Calendly booking link an owner uses to pick a time. Env-overridable; falls back to the live link. */
export function bookingLink(): string {
  return process.env.SETUP_SPRINT_BOOKING_URL ?? "https://aipocketagent.com/setup-sprint/book";
}

/** A Google Calendar "create event" URL with title, details, and a duration window from a start time. */
export function googleCalendarUrl(tier: SprintTier, startsAt: Date): string {
  const minutes = callDurationMinutes(tier);
  const end = new Date(startsAt.getTime() + minutes * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: CALL_TITLE,
    details: callDescription(tier),
    dates: `${fmt(startsAt)}/${fmt(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * An .ics calendar file body for a fixed call time. uid keeps reschedules idempotent in the owner's
 * calendar; CRLF line endings are required by RFC 5545.
 */
export function buildIcs(args: {
  tier: SprintTier;
  startsAt: Date;
  uid: string;
  organizerEmail: string;
}): string {
  const minutes = callDurationMinutes(args.tier);
  const end = new Date(args.startsAt.getTime() + minutes * 60_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pocket Agent//Setup Sprint//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${args.uid}`,
    `DTSTAMP:${stamp(args.startsAt)}`,
    `DTSTART:${stamp(args.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(CALL_TITLE)}`,
    `DESCRIPTION:${escape(callDescription(args.tier))}`,
    `ORGANIZER:mailto:${args.organizerEmail}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** The plain-text invite body for the confirmation email (no fixed time yet — owner books via the link). */
export function inviteEmailBody(tier: SprintTier): { subject: string; lines: string[] } {
  const minutes = callDurationMinutes(tier);
  return {
    subject: `Book your AI Office Setup Sprint call (${minutes} min)`,
    lines: [
      `Your ${tier === "premium" ? "Premium" : "Standard"} Setup Sprint is booked. The next step is your ${minutes}-minute Implementation Call.`,
      `Pick a time here: ${bookingLink()}`,
      "Before the call, fill the short intake so we spend the call building, not gathering: https://aipocketagent.com/app/setup-sprint/intake",
      callDescription(tier),
    ],
  };
}
