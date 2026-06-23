// connectors/recall-ai/types.ts — shared vocabulary + Zod boundary schemas for the Recall.ai
// connector (Meeting Persona, MP-CORE-1).
//
// Recall.ai is the meeting-bot infrastructure that joins Zoom / Google Meet / Teams calls on the
// owner's behalf (SPEC §2.1). Auth is the owner's per-account Recall API key (NOT OAuth) — pasted
// once, stored AES-256-GCM-encrypted (lib/crypto/recall-key.ts), decrypted at call time. Direct
// REST against the Recall API (./client.ts), no SDK (the repo's SDK ban).
//
// All three connector actions are ALWAYS gated: sending a bot into a live meeting, pulling it out,
// and fetching a transcript are each material / privacy-sensitive, so they NEVER become
// auto-approve eligible regardless of success count (SPEC §7 trust ladder + MP-7).

import { z } from "zod";

export const RECALL_AI_CONNECTOR = "recall_ai";

// The approval gate for an action (same vocabulary as the github_build / stripe connectors):
//   "always_gated" — per-action approval that NEVER becomes auto-approve eligible.
export type ApprovalGate = "always_gated";

export type RecallAiActionName =
  | "spawn_meeting_bot"
  | "leave_meeting_bot"
  | "fetch_meeting_transcript";

// Listing shape for the UI / scope surfaces (name + gate, no executable bits).
export type RecallAiActionMeta = {
  name: string;
  connector: typeof RECALL_AI_CONNECTOR;
  action: RecallAiActionName;
  description: string;
  gate: ApprovalGate;
};

// Uniform outcome of executing an action, so the approve route handles every action the same way
// without `any`. `summary` is a human one-liner for the audit log + the chat readout. `authError`
// signals the stored key was rejected (caller surfaces "reconnect Recall.ai").
export type ActionExecOutcome =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; authError: boolean };

// ── Recording mode (per-meeting privacy posture, SPEC §1.5 / MP-2) ──────────────────────────────
// Default is transcripts-only (zero audio retained); the owner opts into audio retention explicitly.
export const RECORDING_MODES = ["transcripts_only", "audio"] as const;
export type RecordingMode = (typeof RECORDING_MODES)[number];

// ── Request schemas (validated before any Recall API round-trip) ─────────────────────────────────

export const SpawnBotInputSchema = z.object({
  meetingUrl: z.string().url().max(2000),
  recordingMode: z.enum(RECORDING_MODES).default("transcripts_only"),
  botName: z.string().min(1).max(100).optional(),
});
export type SpawnBotInput = z.infer<typeof SpawnBotInputSchema>;

export const BotIdInputSchema = z.object({
  botId: z.string().min(1).max(200),
});
export type BotIdInput = z.infer<typeof BotIdInputSchema>;

// ── Response schemas (Recall API — tolerant: .passthrough so extra fields never break parsing) ────
// The fields below are the ones MP-CORE-1 reads. Recall returns much more; we keep what we use and
// let the rest ride. Response shapes are reconciled against live payloads in MP-CORE-2..3.

export const RecallBotSchema = z
  .object({
    id: z.string(),
    status_changes: z
      .array(z.object({ code: z.string(), created_at: z.string().nullable().optional() }).passthrough())
      .optional(),
    meeting_url: z.unknown().optional(),
    recordings: z.array(z.object({}).passthrough()).optional(),
    video_url: z.string().url().nullable().optional(),
  })
  .passthrough();
export type RecallBot = z.infer<typeof RecallBotSchema>;

// Recall transcript endpoint returns an array of speaker-segmented entries. We validate the envelope
// loosely (foundation lane); the lifecycle orchestrator (MP-CORE-3) consumes the detail.
export const RecallTranscriptSchema = z.array(z.object({}).passthrough());
export type RecallTranscript = z.infer<typeof RecallTranscriptSchema>;

// ── Meeting-provider inference (from the meeting URL host) ────────────────────────────────────────
export const MEETING_PROVIDERS = ["zoom", "meet", "teams", "other"] as const;
export type MeetingProvider = (typeof MEETING_PROVIDERS)[number];
