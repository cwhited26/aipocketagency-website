// lib/emails/sequences.ts — the ordered enqueue plans: which template fires, and how long after the
// trigger (purchase). Pure data + a couple of resolvers, so the webhook and the tests agree on offsets.

import type { Tier } from "@/lib/personas/tier-caps";
import { SEQUENCE } from "./registry";

const HOUR = 60;
const DAY = 24 * 60;

export type SequenceStep = {
  slug: string;
  /** Minutes after the trigger to send. 0 = immediate. */
  offsetMinutes: number;
};

// ── Universal post-purchase onboarding (Part 5B). Day-0 immediate, the rest scheduled. The
// plan-specific welcome (Part 5C) is enqueued separately via planWelcomeStep(tier) at offset 0. ──
export const ONBOARDING_SEQUENCE: SequenceStep[] = [
  { slug: "onboarding.day-0-purchase-confirmation", offsetMinutes: 0 },
  { slug: "onboarding.day-0-join-launchpad", offsetMinutes: 2 * HOUR },
  { slug: "onboarding.day-1-business-brain", offsetMinutes: 1 * DAY },
  { slug: "onboarding.day-2-persona", offsetMinutes: 2 * DAY },
  { slug: "onboarding.day-3-workflow", offsetMinutes: 3 * DAY },
  { slug: "onboarding.day-4-mission-control", offsetMinutes: 4 * DAY },
  { slug: "onboarding.day-5-followup", offsetMinutes: 5 * DAY },
  { slug: "onboarding.day-6-capture", offsetMinutes: 6 * DAY },
  { slug: "onboarding.day-7-activation", offsetMinutes: 7 * DAY },
  { slug: "onboarding.day-8-next", offsetMinutes: 8 * DAY },
  { slug: "onboarding.day-10-usage", offsetMinutes: 10 * DAY },
  { slug: "onboarding.day-14-retention", offsetMinutes: 14 * DAY },
];

// ── 14-Day Pilot nurture (Part 5E). Day-0 immediate, the rest scheduled through Day-30 credit expiry. ──
export const PILOT_SEQUENCE: SequenceStep[] = [
  { slug: "pilot.day-0", offsetMinutes: 0 },
  { slug: "pilot.day-1", offsetMinutes: 1 * DAY },
  { slug: "pilot.day-2", offsetMinutes: 2 * DAY },
  { slug: "pilot.day-3", offsetMinutes: 3 * DAY },
  { slug: "pilot.day-4", offsetMinutes: 4 * DAY },
  { slug: "pilot.day-5", offsetMinutes: 5 * DAY },
  { slug: "pilot.day-6", offsetMinutes: 6 * DAY },
  { slug: "pilot.day-7", offsetMinutes: 7 * DAY },
  { slug: "pilot.day-8", offsetMinutes: 8 * DAY },
  { slug: "pilot.day-9", offsetMinutes: 9 * DAY },
  { slug: "pilot.day-10", offsetMinutes: 10 * DAY },
  { slug: "pilot.day-11", offsetMinutes: 11 * DAY },
  { slug: "pilot.day-12", offsetMinutes: 12 * DAY },
  { slug: "pilot.day-13", offsetMinutes: 13 * DAY },
  { slug: "pilot.day-14", offsetMinutes: 14 * DAY },
  { slug: "pilot.day-21-credit-reminder", offsetMinutes: 21 * DAY },
  { slug: "pilot.day-29-credit-expiring", offsetMinutes: 29 * DAY },
  { slug: "pilot.day-30-final-credit-deadline", offsetMinutes: 30 * DAY },
];

// ── DIY Setup Kit delivery (Part 5F). Immediate + Day+1 + Day+3. ──
export const DIY_KIT_SEQUENCE: SequenceStep[] = [
  { slug: "diy-kit.delivery", offsetMinutes: 0 },
  { slug: "diy-kit.start-with-business-brain", offsetMinutes: 1 * DAY },
  { slug: "diy-kit.upgrade-to-subscription", offsetMinutes: 3 * DAY },
];

// ── Done-With-You Setup (Part 5D). Confirmation immediate, pre-call checklist Day+1, the tier reminder
// Day+2 (a sensible default until call_scheduled_at is known), and the Premium-only 30-day check-in.
// The post-call recap is NOT scheduled here — it fires Day+1 from intake/call submit via a dedicated
// helper, since it carries the operator's filled-in loop. ──
export function dwySequence(tier: "standard" | "premium"): SequenceStep[] {
  const steps: SequenceStep[] = [
    { slug: "dwy.confirmation", offsetMinutes: 0 },
    { slug: "dwy.pre-call-checklist", offsetMinutes: 1 * DAY },
    {
      slug: tier === "premium" ? "dwy.premium-reminder" : "dwy.standard-reminder",
      offsetMinutes: 2 * DAY,
    },
  ];
  if (tier === "premium") {
    steps.push({ slug: "dwy.30-day-checkin", offsetMinutes: 30 * DAY });
  }
  return steps;
}

// ── Plan-specific welcome (Part 5C) — picked from the SMB tier, sent immediately. ──
// starter → Personal Brain; pro/pro_plus → Business Agent; studio/studio_plus → AI Agent Workspace.
// (enterprise has no self-serve checkout but maps to AI Agent Workspace if it ever arrives here.)
export function planWelcomeSlug(tier: Tier): string {
  switch (tier) {
    case "starter":
      return "plan-specific.personal-brain-welcome";
    case "pro":
    case "pro_plus":
      return "plan-specific.business-agent-welcome";
    case "studio":
    case "studio_plus":
    case "enterprise":
      return "plan-specific.ai-agent-workspace-welcome";
  }
}

export function planWelcomeStep(tier: Tier): SequenceStep {
  return { slug: planWelcomeSlug(tier), offsetMinutes: 0 };
}

/** Sequences that should be cancelled when a subscription is deleted. */
export const CANCELLABLE_SEQUENCES: readonly string[] = [SEQUENCE.onboarding, SEQUENCE.pilot];

// ── Webinar funnel (Part 3D / GTM Phase 5A). Unlike the post-purchase sequences, these are anchored to
// the live-session timestamp, not the trigger time: the reminders fire before it, live/replay at and
// after it, and the 12-email nurture across the 12 days after. The registration confirmation is the only
// "now"-anchored step — it goes out the instant they register. ──
export type WebinarBase = "now" | "webinar";

export type WebinarSequenceStep = {
  slug: string;
  base: WebinarBase;
  /** Minutes relative to `base`. Negative = before the webinar. */
  offsetMinutes: number;
};

export const WEBINAR_SEQUENCE: WebinarSequenceStep[] = [
  { slug: "webinar.registration-confirmation", base: "now", offsetMinutes: 0 },
  { slug: "webinar.reminder-24h", base: "webinar", offsetMinutes: -24 * HOUR },
  { slug: "webinar.morning-of", base: "webinar", offsetMinutes: -4 * HOUR },
  { slug: "webinar.reminder-1h", base: "webinar", offsetMinutes: -1 * HOUR },
  { slug: "webinar.reminder-15m", base: "webinar", offsetMinutes: -15 },
  { slug: "webinar.live-now", base: "webinar", offsetMinutes: 0 },
  { slug: "webinar.missed-replay", base: "webinar", offsetMinutes: 4 * HOUR },
  { slug: "webinar.attendee-recap", base: "webinar", offsetMinutes: 4 * HOUR },
  { slug: "webinar.problem-agitation", base: "webinar", offsetMinutes: 1 * DAY },
  { slug: "webinar.business-brain", base: "webinar", offsetMinutes: 2 * DAY },
  { slug: "webinar.personas", base: "webinar", offsetMinutes: 3 * DAY },
  { slug: "webinar.apps", base: "webinar", offsetMinutes: 4 * DAY },
  { slug: "webinar.idea-engine", base: "webinar", offsetMinutes: 5 * DAY },
  { slug: "webinar.lead-scout", base: "webinar", offsetMinutes: 6 * DAY },
  { slug: "webinar.mission-control", base: "webinar", offsetMinutes: 7 * DAY },
  { slug: "webinar.guarantee", base: "webinar", offsetMinutes: 8 * DAY },
  { slug: "webinar.plan-choice", base: "webinar", offsetMinutes: 9 * DAY },
  { slug: "webinar.last-call", base: "webinar", offsetMinutes: 10 * DAY },
  { slug: "webinar.pilot-pitch", base: "webinar", offsetMinutes: 11 * DAY },
  { slug: "webinar.diy-kit-pitch", base: "webinar", offsetMinutes: 12 * DAY },
];

export type WebinarScheduledEmail = { slug: string; sendAt: string };

/**
 * Resolve each webinar step to an absolute send_at (ISO). `now` steps anchor to nowMs; `webinar` steps
 * anchor to webinarAtMs. A step whose computed time is already in the past is dropped (a late registrant
 * skips reminders that already passed) — except the immediate registration confirmation, always kept.
 */
export function computeWebinarSchedule(webinarAtMs: number, nowMs: number): WebinarScheduledEmail[] {
  const out: WebinarScheduledEmail[] = [];
  for (const step of WEBINAR_SEQUENCE) {
    const anchor = step.base === "now" ? nowMs : webinarAtMs;
    const at = anchor + step.offsetMinutes * 60_000;
    const immediate = step.base === "now" && step.offsetMinutes === 0;
    if (!immediate && at < nowMs) continue;
    out.push({ slug: step.slug, sendAt: new Date(at).toISOString() });
  }
  return out;
}

// ── Business Brain Workshop pre-session sequence (PA-POS-38 §24.4). Same anchor mechanics as the
// webinar sequence: confirmation now, the rest relative to the attendee's chosen slot. Past-due
// reminders drop for a late booker (someone who books the 1pm slot at 12:40 gets the confirmation
// and the lobby-open email, not the stale T-24h reminder). ──
export const WORKSHOP_SEQUENCE: WebinarSequenceStep[] = [
  { slug: "workshop.purchase-confirmation", base: "now", offsetMinutes: 0 },
  { slug: "workshop.reminder-24h", base: "webinar", offsetMinutes: -24 * HOUR },
  { slug: "workshop.reminder-1h", base: "webinar", offsetMinutes: -1 * HOUR },
  { slug: "workshop.lobby-open", base: "webinar", offsetMinutes: -15 },
];

/** Resolve the workshop steps to absolute send_at ISO timestamps against the attendee's slot. */
export function computeWorkshopSchedule(slotAtMs: number, nowMs: number): WebinarScheduledEmail[] {
  const out: WebinarScheduledEmail[] = [];
  for (const step of WORKSHOP_SEQUENCE) {
    const anchor = step.base === "now" ? nowMs : slotAtMs;
    const at = anchor + step.offsetMinutes * 60_000;
    const immediate = step.base === "now" && step.offsetMinutes === 0;
    if (!immediate && at < nowMs) continue;
    out.push({ slug: step.slug, sendAt: new Date(at).toISOString() });
  }
  return out;
}
