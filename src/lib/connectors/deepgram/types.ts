// connectors/deepgram/types.ts — shared vocabulary + Zod boundary schemas for the Deepgram
// streaming-transcription connector (Meeting Persona, MP-CORE-2; MP-3 vendor lock).
//
// Auth is the owner's per-account Deepgram API key (NOT OAuth) — pasted once, stored
// AES-256-GCM-encrypted (./key.ts), decrypted at call time. Live transcription speaks Deepgram's
// listen WebSocket (wss://api.deepgram.com/v1/listen); validation hits the REST /v1/projects
// endpoint. Direct fetch + WebSocket, no SDK (the repo's SDK ban).
//
// transcribe_meeting_live is ALWAYS gated — starting a live transcription stream consumes metered
// minutes + reads meeting audio, so it never becomes auto-approve eligible (SPEC §7 + MP-7).

import { z } from "zod";

export const DEEPGRAM_CONNECTOR = "deepgram";

// Same gate vocabulary as the recall_ai / github_build connectors.
export type ApprovalGate = "always_gated";

export type DeepgramActionName = "transcribe_meeting_live";

export type DeepgramActionMeta = {
  name: string;
  connector: typeof DEEPGRAM_CONNECTOR;
  action: DeepgramActionName;
  description: string;
  gate: ApprovalGate;
};

export type ActionExecOutcome =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string; authError: boolean };

// ── Live transcription options (→ Deepgram listen WS query params) ───────────────────────────────
// Defaults per the MP-CORE-2 contract: nova-2 / en-US / smart_format / interim_results / diarize /
// endpointing=300. encoding + sample_rate are optional — Deepgram auto-detects containerized audio;
// raw PCM must declare both. The exact values are reconciled against Recall's audio stream in
// MP-CORE-3 (the audio source is not wired in this foundation lane).
export const LiveTranscriptionOptionsSchema = z.object({
  model: z.string().default("nova-2"),
  language: z.string().default("en-US"),
  smartFormat: z.boolean().default(true),
  interimResults: z.boolean().default(true),
  diarize: z.boolean().default(true),
  endpointing: z.number().int().nonnegative().default(300),
  encoding: z.string().optional(),
  sampleRate: z.number().int().positive().optional(),
});
export type LiveTranscriptionOptions = z.infer<typeof LiveTranscriptionOptionsSchema>;

// ── Deepgram live "Results" message (the shape we read off the socket) ───────────────────────────
// Deepgram streams JSON messages; the transcription payloads are type:"Results". Metadata / other
// message types are ignored by the parser. .passthrough() keeps extra fields from breaking parsing.
const DeepgramWordSchema = z
  .object({
    word: z.string().optional(),
    start: z.number().optional(),
    end: z.number().optional(),
    confidence: z.number().optional(),
    speaker: z.number().int().optional(),
  })
  .passthrough();

const DeepgramAlternativeSchema = z
  .object({
    transcript: z.string().optional(),
    confidence: z.number().optional(),
    words: z.array(DeepgramWordSchema).optional(),
  })
  .passthrough();

export const DeepgramResultSchema = z
  .object({
    type: z.string().optional(),
    start: z.number().optional(),
    duration: z.number().optional(),
    is_final: z.boolean().optional(),
    channel: z.object({ alternatives: z.array(DeepgramAlternativeSchema) }).passthrough().optional(),
  })
  .passthrough();
export type DeepgramResult = z.infer<typeof DeepgramResultSchema>;

// ── Normalized transcript chunk (what we persist) ────────────────────────────────────────────────
export type TranscriptChunk = {
  text: string;
  confidence: number | null;
  isFinal: boolean;
  startMs: number;
  endMs: number;
  speakerLabel: string | null;
};
