// types.ts — the Signal Catcher's shared vocabulary + pure decision logic (PA-SIGNAL-1, no I/O).
//
// A signal is an offhand wish in a Persona chat — "I keep meaning to check my pipeline every
// Monday" — that reads as a Ritual the owner never got around to authoring. The classifier
// (classify.ts) scores each owner message; when a signal clears the owner's sensitivity threshold
// and survives the dedup windows below, catch.ts stages ONE signal_catcher_ritual_proposal card.
// This module holds the row shapes, the Zod boundaries (classifier output + card payload), the
// sensitivity→threshold map, and the pure dedup evaluator the tests exercise directly.

import { z } from "zod";

export const SIGNAL_CATCHER_PROPOSAL_KIND = "signal_catcher_ritual_proposal" as const;

/** The one cost-ledger feature slug every classification writes (PA-POS-30 reads this ledger). */
export const SIGNAL_CATCHER_FEATURE_SLUG = "signal_catcher" as const;

// ── Signal types ────────────────────────────────────────────────────────────────────

export const SIGNAL_TYPES = ["recurring_task", "dashboard", "digest", "notification"] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export function isSignalType(value: string): value is SignalType {
  return (SIGNAL_TYPES as readonly string[]).includes(value);
}

// ── Sensitivity (the owner-facing dial) ─────────────────────────────────────────────
//
// Low sensitivity = only the clearest asks get proposed (higher confidence bar). High = catch
// more hunches. The thresholds are the product spec's: 0.85 / 0.70 / 0.55.

export const SENSITIVITIES = ["low", "medium", "high"] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

export function isSensitivity(value: string): value is Sensitivity {
  return (SENSITIVITIES as readonly string[]).includes(value);
}

export const SENSITIVITY_THRESHOLDS: Record<Sensitivity, number> = {
  low: 0.85,
  medium: 0.7,
  high: 0.55,
};

export const DEFAULT_SENSITIVITY: Sensitivity = "medium";

// ── Classifier output (Zod at the model boundary) ───────────────────────────────────
//
// The Haiku call returns strict JSON in this shape. 'not_a_signal' is the honest default — most
// chat messages are not wishes, and the classifier is told to say so.

export const ClassifiedSignalSchema = z.object({
  signal_type: z.enum(["recurring_task", "dashboard", "digest", "notification", "not_a_signal"]),
  confidence: z.number().min(0).max(1),
  suggested_ritual_name: z.string().max(120).optional().default(""),
  /** Natural language the Ritual Scheduler's parser accepts ("every Monday at 8am"). */
  suggested_cadence: z.string().max(160).optional().default(""),
  /** One of the ritual-friendly App slugs offered in the prompt; validated again at propose time. */
  suggested_app_slug: z.string().max(80).optional().default(""),
});

export type ClassifiedSignal = z.infer<typeof ClassifiedSignalSchema>;

// The Apps a proposed ritual may target. A short, honest list — every entry resolves through the
// Ritual Scheduler's own resolveRitualTarget, so a renamed App breaks loudly at propose time.
export const SIGNAL_RITUAL_APP_SLUGS = [
  "daily-brief",
  "lead-scout",
  "follow-up-sweeps",
  "capture-inbox",
] as const;

export const DEFAULT_SIGNAL_APP_SLUG = "daily-brief";

// ── Row shapes (mirror migration 103) ───────────────────────────────────────────────

export type SignalCatchStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "deduped_already_ritualized";

export type SignalCatch = {
  id: string;
  owner_id: string;
  source_persona_chat_id: string | null;
  user_message_id: string | null;
  quote: string;
  classified_signal_type: SignalType;
  confidence: number;
  suggested_ritual_name: string;
  suggested_cadence: string;
  suggested_app_slug: string;
  theme_key: string;
  status: SignalCatchStatus;
  inbox_item_id: string | null;
  ritual_id: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type SignalCatcherSettings = {
  enabled: boolean;
  sensitivity: Sensitivity;
};

export const DEFAULT_SETTINGS: SignalCatcherSettings = {
  enabled: true,
  sensitivity: DEFAULT_SENSITIVITY,
};

// ── Proposal card payload (Zod at the inbox boundary) ───────────────────────────────
//
// Staged on the signal_catcher_ritual_proposal inbox item; the approve route re-parses it before
// creating the ritual, so a hand-edited row can't smuggle an unvalidated shape through.

export const SignalProposalPayloadSchema = z.object({
  signalCatchId: z.string().uuid(),
  quote: z.string().min(1).max(2_000),
  ritualName: z.string().min(1).max(120),
  /** The owner-editable natural-language cadence. */
  cadenceText: z.string().min(1).max(160),
  /** The parser's plain-English echo ("Every Monday at 8:00 AM"), for display only. */
  cadenceSummary: z.string().max(160),
  appSlug: z.string().min(1).max(80),
  appLabel: z.string().min(1).max(120),
  signalType: z.enum(["recurring_task", "dashboard", "digest", "notification"]),
  confidence: z.number().min(0).max(1),
});

export type SignalProposalPayload = z.infer<typeof SignalProposalPayloadSchema>;

// ── Theme key ───────────────────────────────────────────────────────────────────────

/** Normalize a suggested ritual name into the dedup key: lowercase, alphanumerics only,
 *  single-dash separated. "Monday Pipeline Review" → "monday-pipeline-review". */
export function themeKeyOf(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "signal"
  );
}

// ── Dedup windows (pure — unit-tested directly) ─────────────────────────────────────

export const REPROPOSE_WINDOW_DAYS = 7;
export const REJECTED_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export type DedupDecision =
  | { ok: true }
  | {
      ok: false;
      reason: "already_ritualized" | "recently_proposed" | "recently_rejected" | "pending_review";
    };

/**
 * May this candidate signal become a proposal card? Pure — the caller supplies the owner's active
 * rituals and prior catches. The three windows, in check order:
 *   1. An active ritual already carries this name → 'already_ritualized' (recorded, never carded).
 *   2. A prior catch of this theme is still pending review → don't double-stage.
 *   3. The owner rejected this theme inside 30 days → don't nag.
 *   4. This theme was already proposed inside 7 days from the same conversation → don't spam.
 */
export function evaluateSignalDedup(params: {
  candidate: { themeKey: string; conversationId: string | null };
  activeRitualNames: readonly string[];
  priorCatches: ReadonlyArray<
    Pick<SignalCatch, "theme_key" | "status" | "created_at" | "source_persona_chat_id">
  >;
  now: Date;
}): DedupDecision {
  const { candidate, activeRitualNames, priorCatches, now } = params;

  if (activeRitualNames.some((n) => themeKeyOf(n) === candidate.themeKey)) {
    return { ok: false, reason: "already_ritualized" };
  }

  for (const prior of priorCatches) {
    if (prior.theme_key !== candidate.themeKey) continue;
    const ageMs = now.getTime() - new Date(prior.created_at).getTime();

    if (prior.status === "pending_review") {
      return { ok: false, reason: "pending_review" };
    }
    if (prior.status === "rejected" && ageMs < REJECTED_WINDOW_DAYS * DAY_MS) {
      return { ok: false, reason: "recently_rejected" };
    }
    if (
      ageMs < REPROPOSE_WINDOW_DAYS * DAY_MS &&
      prior.source_persona_chat_id !== null &&
      prior.source_persona_chat_id === candidate.conversationId
    ) {
      return { ok: false, reason: "recently_proposed" };
    }
  }

  return { ok: true };
}
