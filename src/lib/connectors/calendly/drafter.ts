// connectors/calendly/drafter.ts — the meeting-routing decision a drafter sub-agent makes when
// the owner asks PA to set up a meeting (task item 7).
//
// Two booking surfaces serve different jobs:
//   • Google Calendar create_event — writes directly onto the OWNER's personal schedule. Right for
//     internal meetings (the owner controls everyone's time) or when there's no Calendly.
//   • Calendly create_one_off_link — mints a self-serve booking link the PROSPECT picks a time
//     from. Right for an external prospect when Calendly is connected — "send Patrick my Calendly
//     link" with the correct meeting type pre-selected.
//
// This is the canonical, pure implementation of that choice; the chat system prompt documents the
// same rule in the tool descriptions so the model picks correctly without the sub-agent. Pure +
// synchronous so it's unit-tested.

export type MeetingRoute = "calendly_one_off_link" | "calendar_create_event";

export type MeetingRouteContext = {
  // The owner has a live Calendly connection.
  hasCalendly: boolean;
  // The owner has a live Google Calendar connection (the fallback surface).
  hasCalendar: boolean;
  // The meeting is with an external prospect (vs. an internal/team meeting).
  isExternalProspect: boolean;
};

export type MeetingRouteDecision = {
  route: MeetingRoute;
  // Owner-facing one-liner explaining the pick (surfaced on the draft card / chat).
  rationale: string;
};

/**
 * Decide which surface to draft a meeting on. Prefer Calendly's one-off link when the meeting is
 * with an external prospect AND Calendly is connected; otherwise fall back to Google Calendar's
 * create_event (internal meetings, or no Calendly). When neither is connected, still return the
 * Calendar route so the caller surfaces the "connect a calendar" path consistently.
 */
export function chooseMeetingRoute(context: MeetingRouteContext): MeetingRouteDecision {
  if (context.isExternalProspect && context.hasCalendly) {
    return {
      route: "calendly_one_off_link",
      rationale:
        "External prospect + Calendly connected — I'll send a one-off Calendly link so they can " +
        "self-book the right meeting type.",
    };
  }
  if (!context.isExternalProspect) {
    return {
      route: "calendar_create_event",
      rationale: "Internal meeting — I'll put it straight on your Google Calendar.",
    };
  }
  // External, but no Calendly: fall back to a calendar event (or the connect path if no calendar).
  return {
    route: "calendar_create_event",
    rationale: context.hasCalendar
      ? "External prospect but no Calendly connected — I'll create a Google Calendar event and invite them."
      : "No booking tool connected yet — connect Calendly or Google Calendar to schedule this.",
  };
}
