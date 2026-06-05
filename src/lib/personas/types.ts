// types.ts — shared row + domain types and Zod schemas for the Personas feature
// (Wave 1, Mode A). Row shapes mirror migration 015. Everything here is provider-
// agnostic data; no I/O.

import { z } from "zod";

// Mode A only this wave. The CHECK in migration 015 enforces this at the DB layer too.
export const PERSONA_MODES = ["internal_team"] as const;
export type PersonaMode = (typeof PERSONA_MODES)[number];

export const PERSONA_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type PersonaStatus = (typeof PERSONA_STATUSES)[number];

export const SEAT_ROLES = ["owner", "manager", "member"] as const;
export type SeatRole = (typeof SEAT_ROLES)[number];

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

// ── Row types (mirror migration 015) ──────────────────────────────────────────────

export type PersonaRow = {
  id: string;
  business_id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  template_key: string;
  tone: ToneKey;
  mode: PersonaMode;
  status: PersonaStatus;
  spec_path: string;
  knowledge_zone_key: string;
  current_spec_version: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonaSpecRow = {
  id: string;
  persona_id: string;
  version: number;
  body_md: string;
  created_at: string;
  created_by: string | null;
};

export type PersonaSeatRow = {
  id: string;
  persona_id: string;
  invited_email: string;
  accepted_user_id: string | null;
  role: SeatRole;
  invited_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

export type PersonaShareTokenRow = {
  token: string;
  persona_id: string;
  mode: PersonaMode;
  seat_id: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export type PersonaConversationRow = {
  id: string;
  persona_id: string;
  seat_id: string | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  token_cost_total: number;
};

export type PersonaMessageRow = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  tokens_used: number;
  blocked_by_containment: boolean;
};

export type PersonaUsageMonthlyRow = {
  persona_id: string;
  month: string;
  message_count: number;
  token_cost: number;
  updated_at: string;
};

// ── Tone calibration (wizard step 2) ───────────────────────────────────────────────

export const TONE_KEYS = ["direct", "conversational", "coach"] as const;
export type ToneKey = (typeof TONE_KEYS)[number];

export const TONE_LABELS: Record<ToneKey, string> = {
  direct: "Direct",
  conversational: "Conversational",
  coach: "Coach-like",
};

export const TONE_GUIDANCE: Record<ToneKey, string> = {
  direct:
    "Be concise and decisive. Lead with the answer. No filler, no hedging. Short sentences. The reader is busy and wants the point.",
  conversational:
    "Be warm and approachable. Write the way a knowledgeable colleague talks — clear, friendly, a little human. Still useful, never chatty for its own sake.",
  coach:
    "Be encouraging and developmental. Explain the why behind the answer, ask a clarifying question when it helps the person learn, and reinforce good instincts.",
};

// ── Shared Zod helpers ──────────────────────────────────────────────────────────────

// A persona name: human-facing label. A slug is derived from it server-side.
export const personaNameSchema = z.string().trim().min(2, "Name is too short").max(80);

export const toneSchema = z.enum(TONE_KEYS);

// Each "must-customize" field answer keyed by the template field key.
export const customFieldsSchema = z.record(z.string(), z.string().max(8_000));

// ── Slug derivation ─────────────────────────────────────────────────────────────────

/** Derives a filesystem/URL-safe slug from a persona name. Always non-empty. */
export function slugifyPersonaName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "persona";
}

/** Brain-repo scope for a persona's files: `personas/<slug>`. */
export function personaScope(slug: string): string {
  return `personas/${slug}`;
}

/** Brain-repo path to a persona's spec file. Mirrors `personas.spec_path`. */
export function personaSpecPath(slug: string): string {
  return `${personaScope(slug)}/persona.md`;
}

/** Brain-repo knowledge directory for a persona. */
export function personaKnowledgeDir(slug: string): string {
  return `${personaScope(slug)}/knowledge`;
}

/** ContainmentGuard zone key for a persona. Mirrors `personas.knowledge_zone_key`. */
export function personaZoneKey(slug: string): string {
  return `persona-${slug}`;
}

/** The glob pattern declared in brain-containment.json for a persona's zone. */
export function personaZonePattern(slug: string): string {
  return `${personaKnowledgeDir(slug)}/**`;
}
