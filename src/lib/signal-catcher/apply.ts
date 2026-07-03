// apply.ts — resolving a Signal Catcher proposal (PA-SIGNAL-1). Approve creates a REAL pa_rituals
// row through the shipped Ritual Scheduler (createRitual + the natural-language parser + the
// PA-RITUAL-8 active-ritual tier cap — the same three checks the manual create route runs), then
// flips the catch row. Reject persists nothing new — it flips the catch row so the 30-day
// suppression window reads it. The Edit path (the pre-filled Ritual wizard) lands back here via
// markSignalCatchRitualized when the wizard's create succeeds.

import { z } from "zod";
import { countActiveRituals, createRitual } from "@/lib/rituals/db";
import { cronNextRun, parseSchedule } from "@/lib/rituals/parser";
import { resolveRitualTarget } from "@/lib/rituals/seed";
import { evaluateCanActivateRitual, type Tier } from "@/lib/personas/tier-caps";
import { resolveInboxItem } from "@/lib/pa-inbox-items";
import { fetchSignalCatchById, resolveSignalCatch } from "./db";
import { signalCatcherLog } from "./log";
import { SignalProposalPayloadSchema } from "./types";

export type ApplyResult =
  | { ok: true; ritualId: string }
  | { ok: false; status: number; error: string };

const OverridesSchema = z.object({
  ritualName: z.string().min(1).max(120).optional(),
  ritualCadence: z.string().min(1).max(160).optional(),
});

export type SignalProposalOverrides = z.infer<typeof OverridesSchema>;

/**
 * Approve a proposal card: cap-check, parse the (possibly owner-edited) cadence, create the
 * ritual, flip the catch row. Returns the Scheduler's own cap/parse reasons verbatim so the card
 * shows the same copy the Rituals surface would.
 */
export async function approveSignalProposal(params: {
  ownerId: string;
  tier: Tier;
  payload: Record<string, unknown>;
  overrides: SignalProposalOverrides;
}): Promise<ApplyResult> {
  const payload = SignalProposalPayloadSchema.safeParse(params.payload);
  if (!payload.success) {
    return { ok: false, status: 422, error: "This proposal is missing its details — reject it and the next catch will stage cleanly." };
  }
  const overrides = OverridesSchema.safeParse(params.overrides);
  if (!overrides.success) {
    return { ok: false, status: 422, error: overrides.error.message };
  }

  const name = (overrides.data.ritualName ?? payload.data.ritualName).trim();
  const cadenceText = (overrides.data.ritualCadence ?? payload.data.cadenceText).trim();

  const target = resolveRitualTarget(payload.data.appSlug);
  if (!target) {
    return { ok: false, status: 422, error: "The App this ritual would run is no longer available." };
  }

  // The PA-RITUAL-8 active-ritual cap — same check, same reason copy, as the manual create route.
  const active = await countActiveRituals(params.ownerId);
  if (!active.ok) return { ok: false, status: active.status, error: active.error };
  const cap = evaluateCanActivateRitual(params.tier, active.data);
  if (!cap.ok) return { ok: false, status: 403, error: cap.reason };

  const schedule = parseSchedule(cadenceText);
  if (!schedule.ok) return { ok: false, status: 422, error: schedule.reason };
  const next = cronNextRun(schedule.schedule.cron, new Date(), {
    biWeekly: schedule.schedule.biWeekly,
    lastRunAt: null,
  });
  if (!next) return { ok: false, status: 422, error: "Couldn't compute that schedule." };

  const created = await createRitual({
    ownerId: params.ownerId,
    name,
    appSlug: target.slug,
    projectPlanId: null,
    appPayload: { note: `From your own words: "${payload.data.quote.slice(0, 300)}"` },
    scheduleCron: schedule.schedule.cron,
    scheduleNaturalText: cadenceText,
    biWeeklySkip: schedule.schedule.biWeekly,
    delivery: "inbox",
    nextRunAt: next.toISOString(),
  });
  if (!created.ok) return { ok: false, status: created.status, error: created.error };

  const flipped = await resolveSignalCatch(payload.data.signalCatchId, params.ownerId, {
    status: "approved",
    ritualId: created.data.id,
  });
  if (!flipped.ok) {
    // The ritual exists — that's the owner-visible outcome. The stale catch row is a logged defect.
    signalCatcherLog.warn("ritual created but the catch row did not flip", {
      ownerId: params.ownerId,
      catchId: payload.data.signalCatchId,
      ritualId: created.data.id,
      error: flipped.error.slice(0, 160),
    });
  }

  return { ok: true, ritualId: created.data.id };
}

/** Reject a proposal card: flip the catch row so the same theme stays quiet for 30 days. */
export async function rejectSignalProposal(params: {
  ownerId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const payload = SignalProposalPayloadSchema.safeParse(params.payload);
  if (!payload.success) {
    signalCatcherLog.warn("reject saw a malformed proposal payload", { ownerId: params.ownerId });
    return;
  }
  const flipped = await resolveSignalCatch(payload.data.signalCatchId, params.ownerId, {
    status: "rejected",
  });
  if (!flipped.ok) {
    signalCatcherLog.warn("catch row did not flip on reject", {
      ownerId: params.ownerId,
      catchId: payload.data.signalCatchId,
      error: flipped.error.slice(0, 160),
    });
  }
}

/**
 * The Edit path's landing: the owner took the proposal into the pre-filled Ritual wizard and
 * created the ritual there. Flip the catch row + resolve its Mission Control card so the proposal
 * doesn't linger as pending. Best-effort by contract — the ritual is already created.
 */
export async function markSignalCatchRitualized(params: {
  ownerId: string;
  signalCatchId: string;
  ritualId: string;
}): Promise<void> {
  const existing = await fetchSignalCatchById(params.signalCatchId, params.ownerId);
  if (!existing.ok || !existing.data) {
    signalCatcherLog.warn("wizard create referenced an unknown catch", {
      ownerId: params.ownerId,
      catchId: params.signalCatchId,
    });
    return;
  }
  if (existing.data.status !== "pending_review") return; // already settled

  const flipped = await resolveSignalCatch(params.signalCatchId, params.ownerId, {
    status: "approved",
    ritualId: params.ritualId,
  });
  if (!flipped.ok) {
    signalCatcherLog.warn("catch row did not flip after wizard create", {
      ownerId: params.ownerId,
      catchId: params.signalCatchId,
      error: flipped.error.slice(0, 160),
    });
    return;
  }
  if (existing.data.inbox_item_id) {
    const resolved = await resolveInboxItem(existing.data.inbox_item_id, "approved", params.ownerId);
    if (!resolved.ok) {
      signalCatcherLog.warn("proposal card did not resolve after wizard create", {
        ownerId: params.ownerId,
        inboxItemId: existing.data.inbox_item_id,
        error: resolved.error.slice(0, 160),
      });
    }
  }
}
