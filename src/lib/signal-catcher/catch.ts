// catch.ts — the Signal Catcher's per-message pipeline (PA-SIGNAL-1): classify → threshold →
// gates → dedup → stage ONE proposal card. Fired from the Persona chat route AFTER the turn has
// fully streamed and persisted (same slot as the LEARN phase) — a catch can never slow or fail a
// chat reply. Every skip has a typed reason and a log line; nothing here throws past the caller's
// best-effort boundary.

import { parseSchedule } from "@/lib/rituals/parser";
import { listRituals } from "@/lib/rituals/db";
import { resolveRitualTarget } from "@/lib/rituals/seed";
import { createInboxItem } from "@/lib/pa-inbox-items";
import { isPublicMode, type PersonaMode } from "@/lib/personas/types";
import { tierAllowsSignalCatcher, type Tier } from "@/lib/personas/tier-caps";
import { classifySignal } from "./classify";
import { runSignalProposalGates } from "./gates";
import {
  attachInboxItem,
  fetchSignalCatcherSettings,
  insertSignalCatch,
  listRecentCatches,
} from "./db";
import { signalCatcherLog } from "./log";
import {
  DEFAULT_SIGNAL_APP_SLUG,
  evaluateSignalDedup,
  isSignalType,
  REJECTED_WINDOW_DAYS,
  SENSITIVITY_THRESHOLDS,
  SIGNAL_CATCHER_FEATURE_SLUG,
  SIGNAL_CATCHER_PROPOSAL_KIND,
  themeKeyOf,
  type SignalProposalPayload,
} from "./types";

export type SignalSkipReason =
  | "public_mode"
  | "tier"
  | "disabled"
  | "not_a_signal"
  | "below_threshold"
  | "incomplete_classification"
  | "cadence_unparseable"
  | "gate_dropped"
  | "deduped"
  | "storage_error";

export type SignalCatchOutcome =
  | { staged: true; catchId: string; inboxItemId: string }
  | { staged: false; reason: SignalSkipReason };

/** Lowercase the leading "Every" of the parser's summary so it reads inside a sentence. */
function inSentence(cadenceSummary: string): string {
  return cadenceSummary.charAt(0).toLowerCase() + cadenceSummary.slice(1);
}

/**
 * Read one owner chat message for a signal and, when everything clears, stage the proposal card.
 * The caller supplies the owner's Anthropic key (already in hand on both chat surfaces) so this
 * path adds no extra pocket_agent_users read on the happy skip. `userMessageId` is the
 * persona_messages FK and is null on non-persona surfaces (the Channels Gateway persists inbound
 * messages in its own store); `costAnchor` is the deterministic per-message idempotency stem the
 * cost ledger dedups on, so every surface must supply one.
 */
export async function runSignalCatcherForMessage(params: {
  ownerId: string;
  tier: Tier;
  personaMode: PersonaMode;
  apiKey: string | null;
  conversationId: string | null;
  userMessageId: string | null;
  costAnchor: string;
  message: string;
}): Promise<SignalCatchOutcome> {
  // Owner-private feature: public visitors chatting a shared persona are not the owner wishing
  // for a ritual — same hard guard the memory cascade and LEARN phase use.
  if (isPublicMode(params.personaMode)) return { staged: false, reason: "public_mode" };
  if (!tierAllowsSignalCatcher(params.tier)) return { staged: false, reason: "tier" };

  const settingsRes = await fetchSignalCatcherSettings(params.ownerId);
  const settings = settingsRes.ok ? settingsRes.data : null;
  if (!settings || !settings.enabled) return { staged: false, reason: "disabled" };
  const threshold = SENSITIVITY_THRESHOLDS[settings.sensitivity];

  const classified = await classifySignal({
    apiKey: params.apiKey,
    message: params.message,
    cost: {
      ownerId: params.ownerId,
      featureSlug: SIGNAL_CATCHER_FEATURE_SLUG,
      idempotencyKey: `signal_catcher:classify:${params.costAnchor}`,
      ...(params.conversationId ? { conversationId: params.conversationId } : {}),
    },
  });
  if (!classified || classified.signal_type === "not_a_signal") {
    return { staged: false, reason: "not_a_signal" };
  }
  if (classified.confidence < threshold) return { staged: false, reason: "below_threshold" };
  if (!isSignalType(classified.signal_type)) return { staged: false, reason: "not_a_signal" };

  const rawName = classified.suggested_ritual_name.trim();
  const rawCadence = classified.suggested_cadence.trim();
  if (!rawName || !rawCadence) {
    signalCatcherLog.info("signal cleared threshold but came back incomplete", {
      ownerId: params.ownerId,
      signalType: classified.signal_type,
    });
    return { staged: false, reason: "incomplete_classification" };
  }

  // The cadence must already parse — the card never proposes a schedule the Scheduler would
  // bounce on approve.
  const schedule = parseSchedule(rawCadence);
  if (!schedule.ok) {
    signalCatcherLog.info("suggested cadence did not parse — dropping the proposal", {
      ownerId: params.ownerId,
      cadence: rawCadence.slice(0, 80),
    });
    return { staged: false, reason: "cadence_unparseable" };
  }

  const target =
    resolveRitualTarget(classified.suggested_app_slug.trim()) ??
    resolveRitualTarget(DEFAULT_SIGNAL_APP_SLUG);
  if (!target) return { staged: false, reason: "incomplete_classification" };

  // Gate Phase (PA-SIGNAL-1): the protected-name rewrite always; the full library behind the
  // platform flag. A proposal the gates drop never becomes a card.
  const gated = await runSignalProposalGates({
    ownerId: params.ownerId,
    quote: params.message,
    ritualName: rawName,
    cadenceSummary: schedule.schedule.summary,
  });
  if (!gated.ok) {
    signalCatcherLog.info("gates dropped a signal proposal", {
      ownerId: params.ownerId,
      reason: gated.reason.slice(0, 160),
    });
    return { staged: false, reason: "gate_dropped" };
  }
  const ritualName = gated.ritualName;
  const themeKey = themeKeyOf(ritualName);

  // Dedup windows: an existing active ritual, a pending card, a fresh rejection, or a re-mention
  // in the same conversation inside 7 days all suppress the proposal.
  const [ritualsRes, recentRes] = await Promise.all([
    listRituals(params.ownerId),
    listRecentCatches(
      params.ownerId,
      new Date(Date.now() - REJECTED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    ),
  ]);
  const activeRitualNames = ritualsRes.ok
    ? ritualsRes.data.filter((r) => r.enabled).map((r) => r.name)
    : [];
  const priorCatches = recentRes.ok ? recentRes.data : [];

  const dedup = evaluateSignalDedup({
    candidate: { themeKey, conversationId: params.conversationId },
    activeRitualNames,
    priorCatches,
    now: new Date(),
  });
  if (!dedup.ok) {
    if (dedup.reason === "already_ritualized") {
      // Recorded (the history surface shows PA noticed and stood down), never carded.
      const recorded = await insertSignalCatch({
        ownerId: params.ownerId,
        conversationId: params.conversationId,
        userMessageId: params.userMessageId,
        quote: params.message,
        signalType: classified.signal_type,
        confidence: classified.confidence,
        ritualName,
        cadence: rawCadence,
        appSlug: target.slug,
        themeKey,
        status: "deduped_already_ritualized",
        inboxItemId: null,
      });
      if (!recorded.ok) {
        signalCatcherLog.warn("failed to record a deduped catch", {
          ownerId: params.ownerId,
          error: recorded.error.slice(0, 160),
        });
      }
    }
    return { staged: false, reason: "deduped" };
  }

  // Stage: the catch row first, then its card, then the back-pointer.
  const inserted = await insertSignalCatch({
    ownerId: params.ownerId,
    conversationId: params.conversationId,
    userMessageId: params.userMessageId,
    quote: params.message,
    signalType: classified.signal_type,
    confidence: classified.confidence,
    ritualName,
    cadence: rawCadence,
    appSlug: target.slug,
    themeKey,
    status: "pending_review",
    inboxItemId: null,
  });
  if (!inserted.ok) {
    signalCatcherLog.error("signal catch insert failed", {
      ownerId: params.ownerId,
      error: inserted.error.slice(0, 160),
    });
    return { staged: false, reason: "storage_error" };
  }

  const payload: SignalProposalPayload = {
    signalCatchId: inserted.data.id,
    quote: params.message.slice(0, 2_000),
    ritualName,
    cadenceText: rawCadence,
    cadenceSummary: schedule.schedule.summary,
    appSlug: target.slug,
    appLabel: target.label,
    signalType: classified.signal_type,
    confidence: classified.confidence,
  };

  const cadence = inSentence(schedule.schedule.summary);
  const card = await createInboxItem({
    userId: params.ownerId,
    kind: SIGNAL_CATCHER_PROPOSAL_KIND,
    title: `Want me to run "${ritualName}" ${cadence}?`,
    bodyMd:
      `You said: "${params.message.slice(0, 500)}"\n\n` +
      `That reads like a standing job. I can set it up as a ritual — ${target.label} runs ` +
      `${cadence}, and the result lands here for your review. Approve it, edit it first, or drop it.`,
    source: "signal-catcher",
    payload: payload as unknown as Record<string, unknown>,
  });
  if (!card.ok) {
    signalCatcherLog.error("proposal card staging failed", {
      ownerId: params.ownerId,
      catchId: inserted.data.id,
      error: card.error.slice(0, 160),
    });
    return { staged: false, reason: "storage_error" };
  }

  const attached = await attachInboxItem(inserted.data.id, params.ownerId, card.data.id);
  if (!attached.ok) {
    signalCatcherLog.warn("catch → card back-pointer patch failed", {
      ownerId: params.ownerId,
      catchId: inserted.data.id,
      error: attached.error.slice(0, 160),
    });
  }

  signalCatcherLog.info("signal proposal staged", {
    ownerId: params.ownerId,
    catchId: inserted.data.id,
    signalType: classified.signal_type,
  });
  return { staged: true, catchId: inserted.data.id, inboxItemId: card.data.id };
}
