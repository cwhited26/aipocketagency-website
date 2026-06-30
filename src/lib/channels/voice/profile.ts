// lib/channels/voice/profile.ts — the per-Persona voice profile + the voice-channel safety policy.
//
// Two concerns, both pure (no I/O), so they're unit-tested in isolation:
//   1. Voice profile — parse personas.voice_profile_json (raw jsonb) into a typed, defaulted shape,
//      and build the system-prompt preamble the dispatcher injects for every voice turn (speaking
//      style + addressing + persona-quip cap + greeting). Existing Personas have {} → neutral defaults.
//   2. Voice safety policy — the spec's approval gates as pure matchers: detect a write-intent turn
//      (read-only by default), and detect the fixed "confirm send" phrase that unlocks a Trust-Ladder
//      domain for execution in the same call.

import { DEFAULT_VOICE_ID } from "./catalog";

// ── Voice profile ───────────────────────────────────────────────────────────────────────────────

export type VoiceProfile = {
  elevenlabsVoiceId: string;
  speakingStyle: string;
  addressing: string;
  maxPersonaQuipsPerCall: number;
  greeting: string;
  farewell: string;
  /** Optional secondary voice id used if the primary fails mid-call. Empty string = none. */
  fallbackVoiceId: string;
};

// Spec §what-the-agent-says: defaults are neutral + professional. KenKaiii's "Taliho" is a per-Persona
// choice an owner can configure via greeting/farewell — never a default.
export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  elevenlabsVoiceId: DEFAULT_VOICE_ID,
  speakingStyle: "warm, concise, professional",
  addressing: "address the caller by first name when known, never 'user'",
  maxPersonaQuipsPerCall: 1,
  greeting: "I'm here. What do you need?",
  farewell: "Goodbye.",
  fallbackVoiceId: "",
};

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function asNonNegativeInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

/**
 * Parse the raw voice_profile_json jsonb (any shape, including null / {} for legacy Personas) into a
 * fully-defaulted VoiceProfile. Never throws — an unknown shape falls back to the neutral default.
 */
export function parseVoiceProfile(raw: unknown): VoiceProfile {
  if (raw === null || typeof raw !== "object") return { ...DEFAULT_VOICE_PROFILE };
  const o = raw as Record<string, unknown>;
  return {
    elevenlabsVoiceId: asString(o.elevenlabs_voice_id, DEFAULT_VOICE_PROFILE.elevenlabsVoiceId),
    speakingStyle: asString(o.speaking_style, DEFAULT_VOICE_PROFILE.speakingStyle),
    addressing: asString(o.addressing, DEFAULT_VOICE_PROFILE.addressing),
    maxPersonaQuipsPerCall: asNonNegativeInt(
      o.max_persona_quips_per_call,
      DEFAULT_VOICE_PROFILE.maxPersonaQuipsPerCall,
    ),
    greeting: asString(o.greeting, DEFAULT_VOICE_PROFILE.greeting),
    farewell: asString(o.farewell, DEFAULT_VOICE_PROFILE.farewell),
    fallbackVoiceId: asString(o.fallback_voice_id, ""),
  };
}

/** Serialize a VoiceProfile back to the jsonb shape stored on personas.voice_profile_json. */
export function serializeVoiceProfile(profile: VoiceProfile): Record<string, unknown> {
  return {
    elevenlabs_voice_id: profile.elevenlabsVoiceId,
    speaking_style: profile.speakingStyle,
    addressing: profile.addressing,
    max_persona_quips_per_call: profile.maxPersonaQuipsPerCall,
    greeting: profile.greeting,
    farewell: profile.farewell,
    fallback_voice_id: profile.fallbackVoiceId,
  };
}

/**
 * Build the system-prompt preamble the dispatcher prepends for a voice turn. Injects speaking style,
 * addressing, and the persona-quip cap, plus the hard voice-channel posture (read-only by default,
 * spoken-length discipline). Deterministic for snapshot testing.
 */
export function buildVoiceSystemPreamble(profile: VoiceProfile): string {
  const quipLine =
    profile.maxPersonaQuipsPerCall <= 0
      ? "Do not add personality quips — stay strictly professional."
      : `Allow at most ${profile.maxPersonaQuipsPerCall} short personality quip${profile.maxPersonaQuipsPerCall === 1 ? "" : "s"} in the whole call.`;
  return [
    "You are answering a live phone call. Your reply is spoken aloud, so keep it short, natural, and",
    "free of markdown, lists, or URLs — one or two sentences unless the caller asks for more.",
    `Speaking style: ${profile.speakingStyle}.`,
    `Addressing: ${profile.addressing}.`,
    quipLine,
    "You are READ-ONLY on this call: you may look things up, summarize, and answer, but you must NOT",
    "send messages, create or change calendar events, modify a CRM, or move money. If the caller asks",
    "for any such action, stage it for approval and tell them you've staged it — do not claim it's done.",
  ].join(" ");
}

// ── Voice safety policy (approval gates, spec §approval-gates) ─────────────────────────────────

// Verbs that signal a write / external-effect action. Read verbs (what/when/who/summarize/find) are
// intentionally absent — those run inline. Kept conservative: a false "write" only over-stages (safe),
// while a missed write would still hit the dispatcher's own Gate Phase (untrusted_origin=true).
const WRITE_INTENT_PATTERNS: readonly RegExp[] = [
  /\bsend\b/i,
  /\breply\b/i,
  /\bforward\b/i,
  /\bdraft\b/i,
  /\bschedule\b/i,
  /\bbook\b/i,
  /\bcreate\s+(an?\s+)?(event|invite|meeting|calendar)/i,
  /\binvite\b/i,
  /\bcancel\b/i,
  /\bdelete\b/i,
  /\bpay\b/i,
  /\btransfer\b/i,
  /\bpurchase\b/i,
  /\bbuy\b/i,
  /\border\b/i,
  /\bpost\b/i,
  /\bpublish\b/i,
  /\bupdate\s+(the\s+)?(crm|deal|contact|record)/i,
];

/**
 * Does this spoken turn request a write / external-effect action? Pure heuristic over the transcript.
 * Read-only by default: a write turn stages an approval card; the agent says "I've staged that."
 */
export function isWriteIntent(transcript: string): boolean {
  return WRITE_INTENT_PATTERNS.some((re) => re.test(transcript));
}

// The fixed unlock phrase (spec §approval-gate 3). One phrase, one execution — no "are you sure" loop.
// Matched tolerant of punctuation/case and a leading filler ("okay, confirm send").
const CONFIRM_SEND_RE = /\bconfirm\s+send\b/i;

/** Did the caller say the fixed "confirm send" phrase that unlocks execution this call? */
export function isConfirmSendPhrase(transcript: string): boolean {
  return CONFIRM_SEND_RE.test(transcript);
}

/** The line the agent speaks when it stages a write for approval (spec §approval-gate 1). */
export const STAGED_REPLY = "I've staged that. Approve in the inbox when you're ready.";

/** The line the agent speaks when the per-tier minute cap is hit (spec §approval-gate 6). */
export const CAP_HANGUP_REPLY =
  "You've hit your voice cap for now. Approve a top-up in the app to continue.";
