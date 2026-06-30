// soul-types.ts — the domain types for the Persona Soul System (Pocket_Agent_Soul_System_SPEC_v1).
//
// The Soul is the third Persona layer (Identity / Skills / Soul). Where Skills learn the WHAT
// (techniques) and the brain holds facts, the Soul learns the HOW — how to work with THIS specific
// owner: their communication style, response preferences, boundaries, the working dynamic. It is
// per-Persona, per-owner, and owner-editable in plain English.
//
// Everything here is pure data + Zod — no I/O. Mirrors the persona-memory module's split: domain
// types live here, the REST data layer in soul-db.ts, the supersession merge in soul-merge.ts.
//
// Inspired by KenKaiii/pocket-agent's "Soul" concept (MIT) — architectural pattern only, no code
// lifted, and PA's Soul is per-Persona rather than global.

import { z } from "zod";

// ── Attribute kinds (the seven dimensions the SPEC locks) ─────────────────────────────────
export const SOUL_ATTRIBUTE_KINDS = [
  "communication_style",
  "response_preference",
  "conversational_rhythm",
  "boundary",
  "surface_preference",
  "working_dynamic",
  "affective_signal",
] as const;
export type SoulAttributeKind = (typeof SOUL_ATTRIBUTE_KINDS)[number];

export function isSoulAttributeKind(v: string): v is SoulAttributeKind {
  return (SOUL_ATTRIBUTE_KINDS as readonly string[]).includes(v);
}

// Owner-facing heading per kind — also the heading used in the runtime system-prompt block. Plain
// English so the owner reads their Soul and recognises themselves (SPEC §Owner controls).
export const SOUL_KIND_LABELS: Record<SoulAttributeKind, string> = {
  communication_style: "Communication style",
  response_preference: "Response preferences",
  conversational_rhythm: "Check-in rhythm",
  boundary: "Boundaries (do not violate)",
  surface_preference: "Formatting & surfaces",
  working_dynamic: "Working dynamic",
  affective_signal: "Reading your state",
};

// One-line blurb per kind for the owner-facing accordion subheads.
export const SOUL_KIND_BLURBS: Record<SoulAttributeKind, string> = {
  communication_style: "Formal or casual, terse or verbose, direct or soft — how you like to be talked to.",
  response_preference: "Preferred length and shape — bullets vs prose, examples vs principles.",
  conversational_rhythm: "When to check in, when to interrupt, and when to just hold and wait.",
  boundary: "Lines you've drawn — 'don't do that', 'always ask first', 'stop asking me about X'.",
  surface_preference: "How to format drafts, which apps to default to, the shorthand you use.",
  working_dynamic: "When you trust it to run vs when you want to review every step.",
  affective_signal: "How to tell when you're busy, stressed, or in flow — and how to adjust.",
};

// Print order for the runtime block + the page: how-to-talk first, boundaries last (the SPEC §7
// example ends on boundaries, set apart as do-not-violate).
export const SOUL_BLOCK_KIND_ORDER: SoulAttributeKind[] = [
  "communication_style",
  "response_preference",
  "surface_preference",
  "conversational_rhythm",
  "working_dynamic",
  "affective_signal",
  "boundary",
];

// ── Confidence thresholds (SPEC §Extraction pipeline) ─────────────────────────────────────
// Below MIN: discarded. [MIN, AUTO]: stages a soul_attribute_proposal Inbox card for one-click
// approval. Above AUTO: lands directly into the Soul. READ_MIN is the runtime read floor — an
// active attribute must clear it (and not be superseded) to load into the system prompt.
export const SOUL_MIN_CONFIDENCE = 0.5;
export const SOUL_AUTO_CONFIDENCE = 0.8;
export const SOUL_READ_MIN_CONFIDENCE = 0.4;
export const SOUL_DEFAULT_CONFIDENCE = 0.5;
// Decay floor — at or below this an attribute drops out of the active set (SPEC §Decay).
export const SOUL_DECAY_FLOOR = 0.3;

/** Clamp any number into the legal [0,1] confidence band. The extractor — never a visitor — owns
 *  this value; clamping here is the structural backstop against a smuggled out-of-range confidence. */
export function clampConfidence(n: number): number {
  if (!Number.isFinite(n)) return SOUL_DEFAULT_CONFIDENCE;
  return Math.max(0, Math.min(1, n));
}

export type SoulConfidenceRoute = "discard" | "propose" | "auto";

/** Where an observation's confidence routes it (SPEC §Extraction pipeline). */
export function routeByConfidence(confidence: number): SoulConfidenceRoute {
  const c = clampConfidence(confidence);
  if (c < SOUL_MIN_CONFIDENCE) return "discard";
  if (c > SOUL_AUTO_CONFIDENCE) return "auto";
  return "propose";
}

// ── Row shape (mirrors migration 092) ─────────────────────────────────────────────────────
export type SoulAttributeRow = {
  id: string;
  persona_id: string;
  owner_id: string;
  attribute_kind: SoulAttributeKind;
  attribute_summary: string;
  attribute_body: string | null;
  confidence: number;
  source_session_id: string | null;
  // Locked attributes are exempt from decay (SPEC §Owner controls — the "Lock" action).
  locked: boolean;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
};

// ── Observation (the extractor's structured output, SPEC §Extraction pipeline) ─────────────
// The Haiku extractor returns zero-to-three observations: {kind, summary, body?, confidence}.
export const SoulObservationSchema = z.object({
  kind: z.enum(SOUL_ATTRIBUTE_KINDS),
  summary: z.string().trim().min(1).max(240),
  body: z.string().trim().max(4_000).optional(),
  // Any finite number — clamped to [0,1] post-parse (clampConfidence). An out-of-range confidence
  // smuggled through the model clamps rather than dropping an otherwise-good observation.
  confidence: z.number(),
});
export type SoulObservation = z.infer<typeof SoulObservationSchema>;

// Capped at three per extraction so one run can't flood the Soul (over-eager writes are the failure
// mode to avoid — same bar as Skills + persona-memory).
export const SOUL_OBSERVATIONS_PER_RUN = 3;
export const SoulExtractDecisionSchema = z.object({
  observations: z.array(SoulObservationSchema).max(SOUL_OBSERVATIONS_PER_RUN).default([]),
});
export type SoulExtractDecision = z.infer<typeof SoulExtractDecisionSchema>;

// ── Decay (SPEC §Decay) ────────────────────────────────────────────────────────────────────
// An attribute decays if not reinforced for 90 days: confidence drops 0.1 per 30-day month of
// dormancy beyond the 90-day grace window. Locked attributes never decay. Pure + unit-tested; a
// cron applies it (not wired in this lane — the read filter already drops anything that has fallen
// below READ_MIN, so an un-swept attribute degrades gracefully rather than lingering at full weight).
export const SOUL_DECAY_GRACE_DAYS = 90;
const DAY_MS = 86_400_000;
const DECAY_MONTH_DAYS = 30;
const DECAY_PER_MONTH = 0.1;

/** The decayed confidence for an attribute given how long it's been dormant. Locked → unchanged. */
export function computeDecayedConfidence(input: {
  confidence: number;
  lastReinforcedAt: string;
  now: number;
  locked: boolean;
}): number {
  if (input.locked) return clampConfidence(input.confidence);
  const reinforced = new Date(input.lastReinforcedAt).getTime();
  if (!Number.isFinite(reinforced)) return clampConfidence(input.confidence);
  const dormantDays = (input.now - reinforced) / DAY_MS;
  if (dormantDays <= SOUL_DECAY_GRACE_DAYS) return clampConfidence(input.confidence);
  // Each started 30-day month of dormancy beyond the 90-day grace window costs 0.1 (ceil: crossing
  // the grace line already counts as the first month).
  const monthsBeyond = Math.ceil((dormantDays - SOUL_DECAY_GRACE_DAYS) / DECAY_MONTH_DAYS);
  return clampConfidence(input.confidence - DECAY_PER_MONTH * monthsBeyond);
}

/** True when a (possibly decayed) attribute should drop out of the active set (SPEC §Decay). */
export function isDecayedOut(decayedConfidence: number): boolean {
  return decayedConfidence <= SOUL_DECAY_FLOOR;
}
