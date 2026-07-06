// lib/emails/enqueue.ts — high-level enqueue helpers the Stripe webhook, activation hooks, and the
// usage gate call. Turns a sequence (slug + offset) into queue rows with computed send_at, and provides
// the single-shot trigger + usage-cap enqueuers with their idempotency guards.

import type { Tier } from "@/lib/personas/tier-caps";
import {
  cancelPendingTriggersForOwner,
  countRecentByTemplate,
  enqueueMany,
  enqueueEmail,
  recordTriggerFired,
  resolveOwnerContact,
  type EnqueueInput,
} from "./queue";
import {
  DIY_KIT_SEQUENCE,
  ONBOARDING_SEQUENCE,
  PILOT_SEQUENCE,
  computeWebinarSchedule,
  computeWorkshopSchedule,
  dwySequence,
  planWelcomeStep,
  type SequenceStep,
} from "./sequences";
import { SEQUENCE } from "./registry";

export type Recipient = {
  ownerId: string | null;
  email: string;
  firstName?: string | null;
};

type EnqueueResult = { ok: true; count: number } | { ok: false; error: string };

function sendAtFor(offsetMinutes: number, nowMs: number): string {
  return new Date(nowMs + offsetMinutes * 60_000).toISOString();
}

/** Map a list of sequence steps to queue rows for one recipient and insert them. */
async function enqueueSteps(
  who: Recipient,
  steps: SequenceStep[],
  sequenceSlug: string | null,
  baseProps: Record<string, unknown>,
  nowMs: number,
): Promise<EnqueueResult> {
  const inputs: EnqueueInput[] = steps.map((s) => ({
    ownerId: who.ownerId,
    email: who.email,
    templateSlug: s.slug,
    templateProps: { email: who.email, firstName: who.firstName ?? null, ...baseProps },
    sequenceSlug,
    sendAt: sendAtFor(s.offsetMinutes, nowMs),
  }));
  const r = await enqueueMany(inputs);
  return r.ok ? { ok: true, count: r.data.length } : { ok: false, error: r.error };
}

/**
 * Universal 12-email onboarding + the plan-specific welcome (immediate), picked from the tier.
 * Both ride the `onboarding.universal` sequence so a cancel-on-churn clears the whole set.
 */
export async function enqueueOnboarding(
  who: Recipient,
  tier: Tier,
  nowMs: number = Date.now(),
): Promise<EnqueueResult> {
  const steps = [planWelcomeStep(tier), ...ONBOARDING_SEQUENCE];
  return enqueueSteps(who, steps, SEQUENCE.onboarding, {}, nowMs);
}

/** 18-email Pilot nurture (Day 0 → Day 30 credit expiry). */
export async function enqueuePilot(who: Recipient, nowMs: number = Date.now()): Promise<EnqueueResult> {
  return enqueueSteps(who, PILOT_SEQUENCE, SEQUENCE.pilot, {}, nowMs);
}

/** 3-email DIY Setup Kit delivery. `downloadUrl` rides into the delivery email's props. */
export async function enqueueDiyKit(
  who: Recipient,
  downloadUrl: string | null,
  nowMs: number = Date.now(),
): Promise<EnqueueResult> {
  const base = downloadUrl ? { downloadUrl } : {};
  return enqueueSteps(who, DIY_KIT_SEQUENCE, SEQUENCE.diy, base, nowMs);
}

/**
 * 20-email webinar sequence (Part 3D). Anchored to the live-session timestamp: reminders before it,
 * live/replay at and after it, the 12-email nurture across the 12 days after. Past-due reminders are
 * dropped (late registrant), the registration confirmation is always kept. Returns the count enqueued.
 */
export async function enqueueWebinar(
  who: Recipient,
  webinarAtMs: number,
  nowMs: number = Date.now(),
): Promise<EnqueueResult> {
  const scheduled = computeWebinarSchedule(webinarAtMs, nowMs);
  const inputs: EnqueueInput[] = scheduled.map((s) => ({
    ownerId: who.ownerId,
    email: who.email,
    templateSlug: s.slug,
    templateProps: { email: who.email, firstName: who.firstName ?? null },
    sequenceSlug: SEQUENCE.webinar,
    sendAt: s.sendAt,
  }));
  const r = await enqueueMany(inputs);
  return r.ok ? { ok: true, count: r.data.length } : { ok: false, error: r.error };
}

/**
 * 4-email Business Brain Workshop pre-session sequence (PA-POS-38 §24.4), anchored to the
 * attendee's chosen slot. `props` carries the lobby URL + display slot time into every email.
 */
export async function enqueueWorkshop(
  who: Recipient,
  slotAtMs: number,
  props: { lobbyUrl: string; slotDisplay: string; bump: boolean },
  nowMs: number = Date.now(),
): Promise<EnqueueResult> {
  const scheduled = computeWorkshopSchedule(slotAtMs, nowMs);
  const inputs: EnqueueInput[] = scheduled.map((s) => ({
    ownerId: who.ownerId,
    email: who.email,
    templateSlug: s.slug,
    templateProps: { email: who.email, firstName: who.firstName ?? null, ...props },
    sequenceSlug: SEQUENCE.workshop,
    sendAt: s.sendAt,
  }));
  const r = await enqueueMany(inputs);
  return r.ok ? { ok: true, count: r.data.length } : { ok: false, error: r.error };
}

/** Done-With-You Setup sequence (Standard or Premium fork). */
export async function enqueueDwy(
  who: Recipient,
  tier: "standard" | "premium",
  nowMs: number = Date.now(),
): Promise<EnqueueResult> {
  return enqueueSteps(who, dwySequence(tier), SEQUENCE.dwy, {}, nowMs);
}

/**
 * Fire a single activation-trigger email, immediately, exactly once per owner. The
 * recordTriggerFired insert is the idempotency gate: if the row already existed the email is NOT
 * enqueued (returns count 0). Used both inline (3-3-3 celebration) and by the daily sweep.
 */
export async function enqueueTriggerEmail(
  who: Recipient,
  triggerSlug: string,
  nowMs: number = Date.now(),
): Promise<EnqueueResult> {
  if (!who.ownerId) return { ok: false, error: "trigger emails require an owner id" };
  const fired = await recordTriggerFired(who.ownerId, triggerSlug);
  if (!fired.ok) return { ok: false, error: fired.error };
  if (!fired.data) return { ok: true, count: 0 }; // already fired — skip
  const r = await enqueueEmail({
    ownerId: who.ownerId,
    email: who.email,
    templateSlug: triggerSlug,
    templateProps: { email: who.email, firstName: who.firstName ?? null },
    sequenceSlug: null,
    sendAt: sendAtFor(0, nowMs),
  });
  return r.ok ? { ok: true, count: 1 } : { ok: false, error: r.error };
}

/**
 * Cancel-on-advance: when an owner takes the next activation step, cancel the matching missing-action
 * reminder if it's still pending in the queue. Maps the advance event to the reminder(s) it obsoletes.
 */
export async function cancelTriggerEmails(
  ownerId: string,
  advance: "business_brain" | "persona" | "workflow" | "mission_control",
): Promise<EnqueueResult> {
  const map: Record<typeof advance, string[]> = {
    business_brain: ["triggers.no-bb-after-24h"],
    persona: ["triggers.bb-no-persona"],
    workflow: ["triggers.persona-no-workflow"],
    mission_control: ["triggers.workflow-no-mission-control"],
  };
  const r = await cancelPendingTriggersForOwner(ownerId, map[advance], "activation_advanced");
  return r.ok ? { ok: true, count: r.data } : { ok: false, error: r.error };
}

const USAGE_CAP_TEMPLATE: Record<string, string> = {
  leads: "usage-caps.leads",
  whisper_hours: "usage-caps.whisper-hours",
  "whisper-hours": "usage-caps.whisper-hours",
  sub_agent_runs: "usage-caps.sub-agent-runs",
  "sub-agent-runs": "usage-caps.sub-agent-runs",
};

// Maps the in-app usage metric key (UsageMetricKey) to the usage-cap email metric. Only the three
// metrics with a Part-5H email are mapped; the rest are intentionally absent (no-op).
const USAGE_METRIC_TO_CAP: Record<string, string> = {
  lead_scout: "leads",
  podcast_whisper: "whisper_hours",
  sub_agent: "sub_agent_runs",
};

/**
 * Gate-side entry point: when the usage gate fires for an owner, resolve their email and enqueue the
 * matching usage-cap upgrade prompt (30-day dedup applies). Unknown / emailless metrics are a no-op so
 * the gate never fails because of the email side-effect.
 */
export async function enqueueUsageCapForOwner(
  ownerId: string,
  metricKey: string,
  nowMs: number = Date.now(),
): Promise<EnqueueResult> {
  const metric = USAGE_METRIC_TO_CAP[metricKey];
  if (!metric) return { ok: true, count: 0 };
  const contact = await resolveOwnerContact(ownerId);
  if (!contact) return { ok: true, count: 0 };
  return enqueueUsageCapEmail({ ownerId, email: contact.email, firstName: contact.firstName }, metric, nowMs);
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Enqueue the usage-cap upgrade prompt for a metric, but only if one wasn't already enqueued for this
 * owner in the last 30 days (don't spam the cap email every blocked run). `metricKey` accepts the
 * usage metric keys (leads / whisper_hours / sub_agent_runs); unknown keys are a no-op.
 */
export async function enqueueUsageCapEmail(
  who: Recipient,
  metricKey: string,
  nowMs: number = Date.now(),
): Promise<EnqueueResult> {
  const templateSlug = USAGE_CAP_TEMPLATE[metricKey];
  if (!templateSlug) return { ok: true, count: 0 };

  const recent = await countRecentByTemplate({
    ownerId: who.ownerId,
    email: who.email,
    templateSlug,
    sinceIso: new Date(nowMs - THIRTY_DAYS_MS).toISOString(),
  });
  if (!recent.ok) return { ok: false, error: recent.error };
  if (recent.data > 0) return { ok: true, count: 0 };

  const r = await enqueueEmail({
    ownerId: who.ownerId,
    email: who.email,
    templateSlug,
    templateProps: { email: who.email, firstName: who.firstName ?? null },
    sequenceSlug: null,
    sendAt: sendAtFor(0, nowMs),
  });
  return r.ok ? { ok: true, count: 1 } : { ok: false, error: r.error };
}
