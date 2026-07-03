// types.ts — the cold-onboarding funnel's shared vocabulary (PA-POS-32, Positioning Lock §22).
//
// The trial "workspace" is one pa_trial_threads row: the composed Persona profile (a TRIMMED
// Custom Agent Builder composition — no brain-repo scopes, the trial has no repo) plus the
// encrypted conversation state. Zod at the state boundary: the state round-trips through an
// AES envelope in the DB, so it re-validates on every decrypt.

import { z } from "zod";
import { ParsedIntentSchema } from "@/lib/agent-builder/types";

// ── §22.4 hard limits ───────────────────────────────────────────────────────────────────────
export const MAX_THREAD_STARTS_PER_24H = 3;
export const COOLOFF_DAYS_AFTER_CANCEL = 7;
/** Meta cost cap: outbound auto-pauses after this many unmigrated turns from one sender. */
export const MAX_UNMIGRATED_TURNS = 20;
export const TRIAL_TTL_DAYS = 14;
/** The value ask fires only after this many real actions delivered (§22.1 step 7). */
export const VALUE_ASK_MIN_ACTIONS = 3;

export const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const TRIAL_TTL_MS = TRIAL_TTL_DAYS * 24 * 60 * 60 * 1000;

// ── Trial thread row (pa_trial_threads) ─────────────────────────────────────────────────────
export const TRIAL_THREAD_STATUSES = [
  "active",
  "paused",
  "declined",
  "converted",
  "expired",
] as const;
export type TrialThreadStatus = (typeof TRIAL_THREAD_STATUSES)[number];

export type TrialThreadRow = {
  sender_phone: string;
  thread_id: string;
  composed_persona_slug: string | null;
  composed_apps: string[];
  composed_skill_slugs: string[];
  conversation_state: string | null;
  turn_count: number;
  actions_delivered: number;
  status: TrialThreadStatus;
  starts_in_window: number;
  window_started_at: string;
  cooloff_until: string | null;
  first_seen_at: string;
  last_active_at: string;
  converted_to_owner_id: string | null;
};

// ── Conversation state (encrypted at rest) ──────────────────────────────────────────────────

// The trimmed composed profile — the Agent Builder composition minus brain scopes / candidate
// Skill (no repo to push to until the owner converts).
export const TrialComposedSchema = z.object({
  specText: z.string().min(1).max(4_000),
  intent: ParsedIntentSchema,
  personaTemplateKey: z.string().min(1).max(40),
  personaName: z.string().min(1).max(120),
  personaSlug: z.string().min(1).max(140),
  tone: z.string().min(1).max(40),
  starterPrompt: z.string().min(1).max(400),
  customFields: z.record(z.string(), z.string()).default({}),
  apps: z.array(z.string().min(1).max(60)).max(20),
  skillSlugs: z.array(z.string().min(1).max(60)).max(10),
});
export type TrialComposed = z.infer<typeof TrialComposedSchema>;

export const ConversationTurnSchema = z.object({
  role: z.enum(["owner", "poc"]),
  text: z.string().max(4_096),
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

export const ConversationStateSchema = z.object({
  // greeted → the turn-2 bundle went out, no composition yet (first message didn't parse).
  // working → composed; discovery + trial work turns.
  stage: z.enum(["greeted", "working"]),
  composed: TrialComposedSchema.nullable().default(null),
  // Accumulated Business Brain facts the owner shared (business, platform, customers…) —
  // migrated into the composed agent's context on conversion.
  facts: z.array(z.string().max(300)).max(40).default([]),
  // Rolling window of recent turns for the trial runner's prompt.
  history: z.array(ConversationTurnSchema).max(16).default([]),
  valueAskSent: z.boolean().default(false),
});
export type ConversationState = z.infer<typeof ConversationStateSchema>;

export function emptyConversationState(): ConversationState {
  return { stage: "greeted", composed: null, facts: [], history: [], valueAskSent: false };
}

// ── Outbound bundle (what one inbound turn produces) ────────────────────────────────────────
export type ColdReplyButton = { id: string; title: string };

export type ColdOutbound =
  | { kind: "text"; text: string }
  | { kind: "buttons"; text: string; buttons: ColdReplyButton[] }
  | { kind: "contact_card" };
