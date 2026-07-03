// lib/channels/voice/realtime/messages.ts — Zod schemas for the two wire protocols the realtime
// bridge sits between: Twilio Media Streams (µ-law frames over the standalone WS service) and the
// OpenAI Realtime API (JSON events over wss://api.openai.com/v1/realtime).
//
// Every inbound WS message is parsed through these schemas before the session touches it
// (PA-CHAN-4 posture applied to sockets: never trust an unparsed frame). Unknown OpenAI event
// types are EXPECTED — the API emits dozens we don't consume — so parseRealtimeEvent returns a
// typed union for the events the bridge acts on and { type: "ignored" } for everything else,
// rather than throwing on novelty.

import { z } from "zod";

// ── Twilio Media Stream frames (the standalone service relays these to the session) ─────────────

// Twilio sends JSON messages over the stream WS: connected → start → media* → stop. The bridge
// consumes start (callSid + streamSid for reply framing), media (base64 µ-law), and stop.
export const TwilioStreamStartSchema = z.object({
  event: z.literal("start"),
  start: z.object({
    streamSid: z.string().min(1),
    callSid: z.string().min(1),
    customParameters: z.record(z.string(), z.string()).optional(),
  }),
});

export const TwilioStreamMediaSchema = z.object({
  event: z.literal("media"),
  media: z.object({
    // Base64 µ-law 8 kHz mono, 20 ms frames by default.
    payload: z.string().min(1),
  }),
});

export const TwilioStreamStopSchema = z.object({
  event: z.literal("stop"),
});

export type TwilioStreamStart = z.infer<typeof TwilioStreamStartSchema>;
export type TwilioStreamMedia = z.infer<typeof TwilioStreamMediaSchema>;

// ── OpenAI Realtime events the bridge consumes ───────────────────────────────────────────────────

// Audio out: base64 µ-law deltas (the session configures g711_ulaw both directions, so Twilio
// frames relay without transcoding).
const AudioDeltaSchema = z.object({
  type: z.enum(["response.output_audio.delta", "response.audio.delta"]),
  delta: z.string().min(1),
});

// The model's spoken-reply transcript (assistant side of the transcript ledger).
const AudioTranscriptDoneSchema = z.object({
  type: z.enum(["response.output_audio_transcript.done", "response.audio_transcript.done"]),
  transcript: z.string(),
});

// The caller's transcribed speech (input side; requires input_audio_transcription in the session).
const InputTranscriptionSchema = z.object({
  type: z.literal("conversation.item.input_audio_transcription.completed"),
  transcript: z.string(),
});

// A completed function call — the bridge STAGES it (never executes) and tells the model so.
const FunctionCallDoneSchema = z.object({
  type: z.literal("response.function_call_arguments.done"),
  call_id: z.string().min(1),
  name: z.string().min(1),
  arguments: z.string(),
});

// Usage accounting on every completed response — the authoritative cost basis.
const ResponseDoneSchema = z.object({
  type: z.literal("response.done"),
  response: z.object({
    usage: z
      .object({
        input_token_details: z
          .object({ audio_tokens: z.number().optional(), text_tokens: z.number().optional() })
          .optional(),
        output_token_details: z.object({ audio_tokens: z.number().optional() }).optional(),
      })
      .nullish(),
  }),
});

const ErrorEventSchema = z.object({
  type: z.literal("error"),
  error: z.object({ message: z.string().optional(), code: z.string().nullish() }).optional(),
});

// The caller started speaking while Poc was mid-reply — barge-in; the bridge clears Twilio's
// buffered audio so Poc stops talking instead of speaking over the caller.
const SpeechStartedSchema = z.object({
  type: z.literal("input_audio_buffer.speech_started"),
});

export type RealtimeInboundEvent =
  | { kind: "audio_delta"; base64Mulaw: string }
  | { kind: "assistant_transcript"; text: string }
  | { kind: "caller_transcript"; text: string }
  | { kind: "function_call"; callId: string; name: string; argumentsJson: string }
  | { kind: "usage"; inputAudioTokens: number; outputAudioTokens: number; inputTextTokens: number }
  | { kind: "speech_started" }
  | { kind: "error"; message: string }
  | { kind: "ignored" };

/** Parse one OpenAI Realtime WS message into the typed union the session consumes. */
export function parseRealtimeEvent(raw: string): RealtimeInboundEvent {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { kind: "error", message: "unparseable realtime frame" };
  }

  const delta = AudioDeltaSchema.safeParse(json);
  if (delta.success) return { kind: "audio_delta", base64Mulaw: delta.data.delta };

  const outTranscript = AudioTranscriptDoneSchema.safeParse(json);
  if (outTranscript.success) return { kind: "assistant_transcript", text: outTranscript.data.transcript };

  const inTranscript = InputTranscriptionSchema.safeParse(json);
  if (inTranscript.success) return { kind: "caller_transcript", text: inTranscript.data.transcript };

  const fnCall = FunctionCallDoneSchema.safeParse(json);
  if (fnCall.success) {
    return {
      kind: "function_call",
      callId: fnCall.data.call_id,
      name: fnCall.data.name,
      argumentsJson: fnCall.data.arguments,
    };
  }

  const done = ResponseDoneSchema.safeParse(json);
  if (done.success) {
    const usage = done.data.response.usage;
    return {
      kind: "usage",
      inputAudioTokens: usage?.input_token_details?.audio_tokens ?? 0,
      outputAudioTokens: usage?.output_token_details?.audio_tokens ?? 0,
      inputTextTokens: usage?.input_token_details?.text_tokens ?? 0,
    };
  }

  const speechStarted = SpeechStartedSchema.safeParse(json);
  if (speechStarted.success) return { kind: "speech_started" };

  const err = ErrorEventSchema.safeParse(json);
  if (err.success) return { kind: "error", message: err.data.error?.message ?? "realtime error" };

  return { kind: "ignored" };
}

// ── Function-call argument schemas (what Poc is allowed to STAGE — never execute — on a call) ────

// Three tools, all write-shaped, all stage-only (PA-CHAN-16: every consequential action a realtime
// call proposes becomes an awaiting-approval inbox card; nothing fires from the call itself).
export const SendEmailArgsSchema = z.object({
  to: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export const ScheduleMeetingArgsSchema = z.object({
  with_who: z.string().min(1),
  when: z.string().min(1),
  topic: z.string().min(1),
});

export const CreateFollowUpArgsSchema = z.object({
  about: z.string().min(1),
  details: z.string().optional(),
});

export type StagedFunctionName = "send_email" | "schedule_meeting" | "create_follow_up";

export function isStagedFunctionName(name: string): name is StagedFunctionName {
  return name === "send_email" || name === "schedule_meeting" || name === "create_follow_up";
}

/** Validate a function call's arguments against its schema. Null = malformed (the bridge declines). */
export function parseFunctionArgs(
  name: StagedFunctionName,
  argumentsJson: string,
): Record<string, unknown> | null {
  let json: unknown;
  try {
    json = JSON.parse(argumentsJson);
  } catch {
    return null;
  }
  const schema =
    name === "send_email"
      ? SendEmailArgsSchema
      : name === "schedule_meeting"
        ? ScheduleMeetingArgsSchema
        : CreateFollowUpArgsSchema;
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : null;
}
