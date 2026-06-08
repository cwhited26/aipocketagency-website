// types.ts — the shared vocabulary of the chat-as-surface layer (PA v5 Wave A).
//
// Everything that crosses an API boundary or lands in pa_chat_messages is validated by a
// Zod schema declared here, so a malformed card payload or a typo'd filter tag fails
// loudly at the edge instead of corrupting the append-only history. Types are derived from
// the schemas (z.infer) — one source of truth, zero `any`.

import { z } from "zod";

// ── Filter tags ───────────────────────────────────────────────────────────────────────
// The closed set of chat-history slices. Every message carries one or more; rows not tied
// to a specific view carry ['general']. Mirrors the CHECK-by-convention in migration 018.
export const FILTER_TAGS = [
  "tasks",
  "personas",
  "brain",
  "docs",
  "capture",
  "inbox",
  "connections",
  "settings",
  "general",
] as const;

export const FilterTagSchema = z.enum(FILTER_TAGS);
export type FilterTag = z.infer<typeof FilterTagSchema>;

export const DEFAULT_FILTER: FilterTag = "general";

// ── Roles ─────────────────────────────────────────────────────────────────────────────
export const MESSAGE_ROLES = ["user", "assistant", "system", "inline_card"] as const;
export const MessageRoleSchema = z.enum(MESSAGE_ROLES);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

// ── Card kinds ────────────────────────────────────────────────────────────────────────
export const CARD_KINDS = [
  "memory_write",
  "persona_invoke",
  "doc_preview",
  "voice_memo",
  "screenshot",
  "sub_agent_activity",
  "action_approval",
  "persona_response",
  "tool_call",
] as const;
export const CardKindSchema = z.enum(CARD_KINDS);
export type CardKind = z.infer<typeof CardKindSchema>;

// ── Card payload schemas (one per kind) ─────────────────────────────────────────────────
// Each card renderer in src/components/chat/cards consumes exactly one of these, parsed
// from card_payload jsonb. Keep these in lockstep with the renderer props.

export const MemoryWritePayloadSchema = z.object({
  // Plain-language summary of what was written.
  summary: z.string().min(1).max(2_000),
  // Which memory tier the entry landed in (Active / Knowledge / Patterns), if known.
  tier: z.string().max(120).optional(),
  // Repo-relative path of the brain file that changed.
  path: z.string().max(500),
  // Commit SHA, when the write committed to the brain repo.
  sha: z.string().max(80).optional(),
});
export type MemoryWritePayload = z.infer<typeof MemoryWritePayloadSchema>;

export const PersonaInvokePayloadSchema = z.object({
  personaId: z.string().max(80),
  personaName: z.string().min(1).max(200),
  // The owner's question, echoed back on the card.
  question: z.string().max(20_000),
  // Inline answer when one is available (Wave A surfaces a deep link; the inline LLM
  // answer streams in with the Wave B dispatcher).
  answer: z.string().max(40_000).optional(),
  // Deep link into the persona's full chat thread.
  openHref: z.string().max(500),
});
export type PersonaInvokePayload = z.infer<typeof PersonaInvokePayloadSchema>;

export const DocPreviewPayloadSchema = z.object({
  fileName: z.string().min(1).max(500),
  mimeType: z.string().max(200).optional(),
  sizeBytes: z.number().int().nonnegative().max(5_000_000_000).optional(),
  // First ~200 chars of text, or a caption for binary files.
  excerpt: z.string().max(2_000).optional(),
  thumbnailUrl: z.string().max(2_000).optional(),
  openHref: z.string().max(500).optional(),
});
export type DocPreviewPayload = z.infer<typeof DocPreviewPayloadSchema>;

export const VoiceMemoPayloadSchema = z.object({
  durationSeconds: z.number().int().nonnegative().max(86_400),
  transcriptSnippet: z.string().max(2_000),
  // Full-transcript location (brain path) when saved.
  path: z.string().max(500).optional(),
  openHref: z.string().max(500).optional(),
});
export type VoiceMemoPayload = z.infer<typeof VoiceMemoPayloadSchema>;

export const ScreenshotPayloadSchema = z.object({
  thumbnailUrl: z.string().max(2_000).optional(),
  // OCR / extracted text.
  extractedText: z.string().max(4_000).optional(),
  fileName: z.string().max(500).optional(),
  openHref: z.string().max(500).optional(),
});
export type ScreenshotPayload = z.infer<typeof ScreenshotPayloadSchema>;

// Wave B placeholder — schema-ready, no real runtime in Wave A.
export const SubAgentActivityPayloadSchema = z.object({
  label: z.string().max(300).optional(),
  // Echoed for forward-compat; the renderer shows a faded "coming soon" preview.
  phase: z
    .enum(["observe", "think", "plan", "build", "execute", "verify", "learn"])
    .optional(),
  note: z.string().max(2_000).optional(),
});
export type SubAgentActivityPayload = z.infer<typeof SubAgentActivityPayloadSchema>;

// Wave B placeholder — renders a sample approval card with disabled buttons.
export const ActionApprovalPayloadSchema = z.object({
  connector: z.string().max(120).optional(),
  action: z.string().max(120).optional(),
  preview: z.string().max(4_000).optional(),
});
export type ActionApprovalPayload = z.infer<typeof ActionApprovalPayloadSchema>;

export const PersonaResponsePayloadSchema = z.object({
  personaId: z.string().max(80),
  personaName: z.string().min(1).max(200),
  answer: z.string().max(40_000),
  openHref: z.string().max(500).optional(),
});
export type PersonaResponsePayload = z.infer<typeof PersonaResponsePayloadSchema>;

// Tool-call activity card (PA v5 connector bridge). The chat-send tool-use loop appends one of
// these every time the agent fires a Connection: a read runs inline and lands status='ok'/'error'
// with the result preview; a write is staged to the Approval Inbox and lands status='staged'.
export const ToolCallPayloadSchema = z.object({
  // Canonical tool id the agent invoked, e.g. "connector.gmail.list_recent".
  tool: z.string().min(1).max(120),
  // Human card title, e.g. "Checked your Gmail".
  label: z.string().min(1).max(200),
  // read tools resolve to ok|error; write tools resolve to staged (queued for approval).
  status: z.enum(["ok", "error", "staged"]),
  // One-line outcome, e.g. "Found 5 recent messages" / "Queued for your approval".
  summary: z.string().min(1).max(2_000),
  // Optional multi-line preview of the result (read) or the staged action (write).
  detail: z.string().max(8_000).optional(),
  // Deep link to where the result/approval lives (e.g. the Inbox for a staged write).
  openHref: z.string().max(500).optional(),
});
export type ToolCallPayload = z.infer<typeof ToolCallPayloadSchema>;

// Maps a card kind to its payload schema. Used by validateCardPayload + the renderers'
// prop-validation tests.
export const CARD_PAYLOAD_SCHEMAS = {
  memory_write: MemoryWritePayloadSchema,
  persona_invoke: PersonaInvokePayloadSchema,
  doc_preview: DocPreviewPayloadSchema,
  voice_memo: VoiceMemoPayloadSchema,
  screenshot: ScreenshotPayloadSchema,
  sub_agent_activity: SubAgentActivityPayloadSchema,
  action_approval: ActionApprovalPayloadSchema,
  persona_response: PersonaResponsePayloadSchema,
  tool_call: ToolCallPayloadSchema,
} satisfies Record<CardKind, z.ZodTypeAny>;

/**
 * Parses an unknown card payload against the schema for its kind. Throws ZodError on a
 * mismatch (callers translate to a 400 / a skipped render). Centralizes the kind→schema
 * dispatch so a new card can't be persisted without a payload contract.
 */
export function validateCardPayload(kind: CardKind, payload: unknown): unknown {
  return CARD_PAYLOAD_SCHEMAS[kind].parse(payload);
}

// ── Chat message ────────────────────────────────────────────────────────────────────────
// The row shape as it comes back from PostgREST.
export const ChatMessageSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    role: MessageRoleSchema,
    content: z.string(),
    card_kind: CardKindSchema.nullable(),
    card_payload: z.unknown().nullable(),
    parent_message_id: z.string().nullable(),
    filter_tags: z.array(FilterTagSchema).min(1),
    created_at: z.string(),
    archived_at: z.string().nullable(),
  })
  .superRefine((row, ctx) => {
    // Mirror the DB CHECK at the type boundary so a hand-rolled row can't slip through.
    if (row.role === "inline_card" && row.card_kind === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "inline_card rows require a card_kind",
        path: ["card_kind"],
      });
    }
    if (row.role !== "inline_card" && row.card_kind !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "non-card rows must not carry a card_kind",
        path: ["card_kind"],
      });
    }
  });
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// Input accepted by the chat-send API.
export const SendMessageSchema = z.object({
  content: z.string().min(1, "Message is empty").max(50_000),
});
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

// Input accepted by the filter-state API.
export const SetFilterSchema = z.object({
  filter: FilterTagSchema,
});
export type SetFilterInput = z.infer<typeof SetFilterSchema>;
