// types.ts — shared row + domain types and Zod schemas for the Personas feature.
// Row shapes mirror migrations 015 (Mode A) + 016 (Modes B/C). Everything here is
// provider-agnostic data; no I/O.

import { z } from "zod";

// Mode A (internal_team) shipped Wave 1. Modes B (public_link) + C (widget) ship Wave 2,
// behind the PA_PERSONAS_PUBLIC_MODES_ENABLED flag. The CHECK in migration 016 mirrors
// this set at the DB layer.
export const PERSONA_MODES = ["internal_team", "public_link", "widget"] as const;
export type PersonaMode = (typeof PERSONA_MODES)[number];

export const modeSchema = z.enum(PERSONA_MODES);

/** Modes that expose anonymous, unauthenticated traffic (require Wave 2 protections). */
export const PUBLIC_MODES: readonly PersonaMode[] = ["public_link", "widget"];
export function isPublicMode(mode: PersonaMode): boolean {
  return PUBLIC_MODES.includes(mode);
}

export const PERSONA_MODE_LABELS: Record<PersonaMode, string> = {
  internal_team: "Internal team",
  public_link: "Public link",
  widget: "Website widget",
};

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
  notified_50: boolean;
  notified_80: boolean;
  notified_100: boolean;
};

// ── Wave 2 rows (mirror migration 016) ─────────────────────────────────────────────

export const RATE_LIMIT_SCOPES = [
  "ip_hour",
  "session_day",
  "persona_day",
  "blocked_hour",
] as const;
export type RateLimitScope = (typeof RATE_LIMIT_SCOPES)[number];

export const LEAD_SOURCES = ["public_link", "widget", "pre_chat_form"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = ["new", "contacted", "qualified", "junk"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type PersonaLeadRow = {
  id: string;
  persona_id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  conversation_id: string | null;
  source: LeadSource;
  status: LeadStatus;
  created_at: string;
};

export const BUBBLE_POSITIONS = ["bottom-right", "bottom-left"] as const;
export type BubblePosition = (typeof BUBBLE_POSITIONS)[number];

export const LEAD_CAPTURE_TIMINGS = [
  "pre_chat",
  "mid_conversation",
  "post_conversation",
  "off",
] as const;
export type LeadCaptureTiming = (typeof LEAD_CAPTURE_TIMINGS)[number];

export type PersonaWidgetConfigRow = {
  persona_id: string;
  allowed_origins: string[];
  greeting_text: string;
  bubble_color: string;
  bubble_position: BubblePosition;
  lead_capture_timing: LeadCaptureTiming;
  lead_capture_enabled: boolean;
  off_topic_message: string | null;
  badge_removed: boolean;
  created_at: string;
  updated_at: string;
};

/** Safe defaults for a persona that has no widget config row yet. */
export const DEFAULT_WIDGET_CONFIG: Omit<
  PersonaWidgetConfigRow,
  "persona_id" | "created_at" | "updated_at"
> = {
  allowed_origins: [],
  greeting_text: "Hi! How can I help you today?",
  bubble_color: "#22d3ee",
  bubble_position: "bottom-right",
  lead_capture_timing: "pre_chat",
  lead_capture_enabled: true,
  off_topic_message: null,
  badge_removed: false,
};

// ── Wave 2 Zod schemas (API boundaries) ─────────────────────────────────────────────

// A hex color like #22d3ee (or #2a2 short form). Rejects anything that could break out
// of the inline style / CSS context in the widget loader.
export const bubbleColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex color like #22d3ee");

// An allowlisted origin: scheme://host[:port], no path. Normalized lowercase.
export const originSchema = z
  .string()
  .trim()
  .max(253)
  .regex(/^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?$/i, "Must look like https://example.com")
  .transform((s) => s.toLowerCase().replace(/\/$/, ""));

export const widgetConfigUpdateSchema = z.object({
  allowed_origins: z.array(originSchema).max(50).optional(),
  greeting_text: z.string().trim().max(280).optional(),
  bubble_color: bubbleColorSchema.optional(),
  bubble_position: z.enum(BUBBLE_POSITIONS).optional(),
  lead_capture_timing: z.enum(LEAD_CAPTURE_TIMINGS).optional(),
  lead_capture_enabled: z.boolean().optional(),
  off_topic_message: z.string().trim().max(400).nullable().optional(),
  badge_removed: z.boolean().optional(),
});
export type WidgetConfigUpdate = z.infer<typeof widgetConfigUpdateSchema>;

// Pre-chat lead form. Email required; name + phone optional (SPEC v3 §9 Mode B).
export const preChatLeadSchema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});
export type PreChatLead = z.infer<typeof preChatLeadSchema>;

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
