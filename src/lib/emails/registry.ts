// lib/emails/registry.ts — the single source of truth mapping a stored template_slug to its render
// function, its zod prop schema, and its transactional flag. The scheduler renders from (slug, jsonb
// props); the webhook + activation hooks enqueue by slug. Props are validated here so a malformed
// queue row fails loudly at render, never ships a broken email.

import { z } from "zod";
import type { RenderedEmail } from "./render";
import {
  day0PurchaseConfirmation,
  day0JoinLaunchpad,
  day1BusinessBrain,
  day2Persona,
  day3Workflow,
  day4MissionControl,
  day5Followup,
  day6Capture,
  day7Activation,
  day8Next,
  day10Usage,
  day14Retention,
} from "./templates/onboarding/onboarding";
import {
  personalBrainWelcome,
  businessAgentWelcome,
  aiAgentWorkspaceWelcome,
} from "./templates/plan-specific/plan-specific";
import {
  dwyConfirmation,
  dwyPreCallChecklist,
  dwyStandardReminder,
  dwyPremiumReminder,
  dwyPostCallRecap,
  dwy30DayCheckin,
} from "./templates/dwy/dwy";
import {
  pilotDay0,
  pilotDay1,
  pilotDay2,
  pilotDay3,
  pilotDay4,
  pilotDay5,
  pilotDay6,
  pilotDay7,
  pilotDay8,
  pilotDay9,
  pilotDay10,
  pilotDay11,
  pilotDay12,
  pilotDay13,
  pilotDay14,
  pilotDay21CreditReminder,
  pilotDay29CreditExpiring,
  pilotDay30FinalDeadline,
} from "./templates/pilot/pilot";
import {
  diyDelivery,
  diyStartWithBusinessBrain,
  diyUpgradeToSubscription,
} from "./templates/diy-kit/diy-kit";
import {
  noBbAfter24h,
  bbNoPersona,
  personaNoWorkflow,
  workflowNoMissionControl,
  threeThreeThreeComplete,
} from "./templates/triggers/triggers";
import { leadsCap, whisperHoursCap, subAgentRunsCap } from "./templates/usage-caps/usage-caps";
import {
  personalToBusiness,
  businessToAaw,
  proPlusToStudio,
  studioToAaw,
  aawToEnterprise,
} from "./templates/upgrades/upgrades";
import { cancellationConfirmation } from "./templates/cancellation/cancellation";
import {
  registrationConfirmation,
  reminder24h,
  morningOf,
  reminder1h,
  reminder15m,
  liveNow,
  missedReplay,
  attendeeRecap,
  problemAgitation,
  businessBrain,
  personas,
  apps,
  ideaEngine,
  leadScout,
  missionControl,
  guarantee,
  planChoice,
  lastCall,
  pilotPitch,
  diyKitPitch,
} from "./templates/webinar/webinar";

const baseSchema = z.object({
  email: z.string().min(3),
  firstName: z.string().nullish(),
});

const dwyRecapSchema = baseSchema.extend({
  businessBrain: z.string().optional(),
  persona: z.string().optional(),
  workflow: z.string().optional(),
  missionControlReview: z.string().optional(),
  nextAction: z.string().optional(),
});

const diyDeliverySchema = baseSchema.extend({
  downloadUrl: z.string().optional(),
});

type RegistryEntry = {
  /** Validates props against the schema, then renders. Throws on invalid props. */
  render: (props: unknown) => RenderedEmail;
  transactional: boolean;
  /** The sequence this template belongs to, for cancellation lookups (null = standalone). */
  sequence: string | null;
};

// Wrap a typed template fn + its schema into a registry entry that takes unknown props.
function entry<T>(
  schema: z.ZodType<T>,
  fn: (props: T) => RenderedEmail,
  transactional: boolean,
  sequence: string | null,
): RegistryEntry {
  return {
    render: (props: unknown) => fn(schema.parse(props)),
    transactional,
    sequence,
  };
}

const base = (fn: (p: z.infer<typeof baseSchema>) => RenderedEmail, transactional: boolean, sequence: string | null) =>
  entry(baseSchema, fn, transactional, sequence);

export const SEQUENCE = {
  onboarding: "onboarding.universal",
  pilot: "pilot.nurture",
  dwy: "dwy.setup",
  diy: "diy.delivery",
  webinar: "webinar.sequence",
} as const;

export const EMAIL_REGISTRY: Record<string, RegistryEntry> = {
  // ── Onboarding universal (12) ──
  "onboarding.day-0-purchase-confirmation": base(day0PurchaseConfirmation, true, SEQUENCE.onboarding),
  "onboarding.day-0-join-launchpad": base(day0JoinLaunchpad, false, SEQUENCE.onboarding),
  "onboarding.day-1-business-brain": base(day1BusinessBrain, false, SEQUENCE.onboarding),
  "onboarding.day-2-persona": base(day2Persona, false, SEQUENCE.onboarding),
  "onboarding.day-3-workflow": base(day3Workflow, false, SEQUENCE.onboarding),
  "onboarding.day-4-mission-control": base(day4MissionControl, false, SEQUENCE.onboarding),
  "onboarding.day-5-followup": base(day5Followup, false, SEQUENCE.onboarding),
  "onboarding.day-6-capture": base(day6Capture, false, SEQUENCE.onboarding),
  "onboarding.day-7-activation": base(day7Activation, false, SEQUENCE.onboarding),
  "onboarding.day-8-next": base(day8Next, false, SEQUENCE.onboarding),
  "onboarding.day-10-usage": base(day10Usage, false, SEQUENCE.onboarding),
  "onboarding.day-14-retention": base(day14Retention, false, SEQUENCE.onboarding),

  // ── Plan-specific (3) — immediate onboarding welcome alongside Day-0. Marketing (not transactional):
  // it's part of the onboarding sequence and respects the unsubscribe list like the rest. ──
  "plan-specific.personal-brain-welcome": base(personalBrainWelcome, false, SEQUENCE.onboarding),
  "plan-specific.business-agent-welcome": base(businessAgentWelcome, false, SEQUENCE.onboarding),
  "plan-specific.ai-agent-workspace-welcome": base(aiAgentWorkspaceWelcome, false, SEQUENCE.onboarding),

  // ── Done-With-You Setup (6) ──
  "dwy.confirmation": base(dwyConfirmation, true, SEQUENCE.dwy),
  "dwy.pre-call-checklist": base(dwyPreCallChecklist, false, SEQUENCE.dwy),
  "dwy.standard-reminder": base(dwyStandardReminder, false, SEQUENCE.dwy),
  "dwy.premium-reminder": base(dwyPremiumReminder, false, SEQUENCE.dwy),
  "dwy.post-call-recap": entry(dwyRecapSchema, dwyPostCallRecap, false, SEQUENCE.dwy),
  "dwy.30-day-checkin": base(dwy30DayCheckin, false, SEQUENCE.dwy),

  // ── Pilot nurture (18) ──
  "pilot.day-0": base(pilotDay0, true, SEQUENCE.pilot),
  "pilot.day-1": base(pilotDay1, false, SEQUENCE.pilot),
  "pilot.day-2": base(pilotDay2, false, SEQUENCE.pilot),
  "pilot.day-3": base(pilotDay3, false, SEQUENCE.pilot),
  "pilot.day-4": base(pilotDay4, false, SEQUENCE.pilot),
  "pilot.day-5": base(pilotDay5, false, SEQUENCE.pilot),
  "pilot.day-6": base(pilotDay6, false, SEQUENCE.pilot),
  "pilot.day-7": base(pilotDay7, false, SEQUENCE.pilot),
  "pilot.day-8": base(pilotDay8, false, SEQUENCE.pilot),
  "pilot.day-9": base(pilotDay9, false, SEQUENCE.pilot),
  "pilot.day-10": base(pilotDay10, false, SEQUENCE.pilot),
  "pilot.day-11": base(pilotDay11, false, SEQUENCE.pilot),
  "pilot.day-12": base(pilotDay12, false, SEQUENCE.pilot),
  "pilot.day-13": base(pilotDay13, false, SEQUENCE.pilot),
  "pilot.day-14": base(pilotDay14, false, SEQUENCE.pilot),
  "pilot.day-21-credit-reminder": base(pilotDay21CreditReminder, false, SEQUENCE.pilot),
  "pilot.day-29-credit-expiring": base(pilotDay29CreditExpiring, false, SEQUENCE.pilot),
  "pilot.day-30-final-credit-deadline": base(pilotDay30FinalDeadline, false, SEQUENCE.pilot),

  // ── DIY Setup Kit delivery (3) ──
  "diy-kit.delivery": entry(diyDeliverySchema, diyDelivery, true, SEQUENCE.diy),
  "diy-kit.start-with-business-brain": base(diyStartWithBusinessBrain, false, SEQUENCE.diy),
  "diy-kit.upgrade-to-subscription": base(diyUpgradeToSubscription, false, SEQUENCE.diy),

  // ── Activation triggers (5) — standalone ──
  "triggers.no-bb-after-24h": base(noBbAfter24h, false, null),
  "triggers.bb-no-persona": base(bbNoPersona, false, null),
  "triggers.persona-no-workflow": base(personaNoWorkflow, false, null),
  "triggers.workflow-no-mission-control": base(workflowNoMissionControl, false, null),
  "triggers.three-three-three-complete": base(threeThreeThreeComplete, false, null),

  // ── Usage-cap prompts (3) — standalone ──
  "usage-caps.leads": base(leadsCap, false, null),
  "usage-caps.whisper-hours": base(whisperHoursCap, false, null),
  "usage-caps.sub-agent-runs": base(subAgentRunsCap, false, null),

  // ── Plan upgrade emails (5) — standalone ──
  "upgrades.personal-to-business": base(personalToBusiness, false, null),
  "upgrades.business-to-aaw": base(businessToAaw, false, null),
  "upgrades.pro-plus-to-studio": base(proPlusToStudio, false, null),
  "upgrades.studio-to-aaw": base(studioToAaw, false, null),
  "upgrades.aaw-to-enterprise": base(aawToEnterprise, false, null),

  // ── Cancellation (1) — transactional ──
  "cancellation.confirmation": base(cancellationConfirmation, true, null),

  // ── Webinar funnel (20) — GTM Phase 5A, Part 3D. All marketing (opt-in webinar list), all ride the
  // `webinar.sequence` so an unsubscribe/cancel clears the whole set. ──
  "webinar.registration-confirmation": base(registrationConfirmation, false, SEQUENCE.webinar),
  "webinar.reminder-24h": base(reminder24h, false, SEQUENCE.webinar),
  "webinar.morning-of": base(morningOf, false, SEQUENCE.webinar),
  "webinar.reminder-1h": base(reminder1h, false, SEQUENCE.webinar),
  "webinar.reminder-15m": base(reminder15m, false, SEQUENCE.webinar),
  "webinar.live-now": base(liveNow, false, SEQUENCE.webinar),
  "webinar.missed-replay": base(missedReplay, false, SEQUENCE.webinar),
  "webinar.attendee-recap": base(attendeeRecap, false, SEQUENCE.webinar),
  "webinar.problem-agitation": base(problemAgitation, false, SEQUENCE.webinar),
  "webinar.business-brain": base(businessBrain, false, SEQUENCE.webinar),
  "webinar.personas": base(personas, false, SEQUENCE.webinar),
  "webinar.apps": base(apps, false, SEQUENCE.webinar),
  "webinar.idea-engine": base(ideaEngine, false, SEQUENCE.webinar),
  "webinar.lead-scout": base(leadScout, false, SEQUENCE.webinar),
  "webinar.mission-control": base(missionControl, false, SEQUENCE.webinar),
  "webinar.guarantee": base(guarantee, false, SEQUENCE.webinar),
  "webinar.plan-choice": base(planChoice, false, SEQUENCE.webinar),
  "webinar.last-call": base(lastCall, false, SEQUENCE.webinar),
  "webinar.pilot-pitch": base(pilotPitch, false, SEQUENCE.webinar),
  "webinar.diy-kit-pitch": base(diyKitPitch, false, SEQUENCE.webinar),
};

export type EmailTemplateSlug = keyof typeof EMAIL_REGISTRY;

export function isTemplateSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(EMAIL_REGISTRY, slug);
}

export function getRegistryEntry(slug: string): RegistryEntry | null {
  return isTemplateSlug(slug) ? EMAIL_REGISTRY[slug] : null;
}

/** Render a template by slug with arbitrary (jsonb) props. Returns null if the slug is unknown. */
export function renderBySlug(slug: string, props: unknown): RenderedEmail | null {
  const e = getRegistryEntry(slug);
  if (!e) return null;
  return e.render(props);
}

/** Is this template transactional (bypasses marketing-unsubscribe suppression)? */
export function isTransactional(slug: string): boolean {
  return getRegistryEntry(slug)?.transactional ?? false;
}
