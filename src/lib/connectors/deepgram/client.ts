// connectors/deepgram/client.ts — direct REST + WebSocket client for Deepgram (Meeting Persona,
// MP-CORE-2). No SDK (repo SDK ban).
//
//   • verifyApiKey            — REST GET /v1/projects (the auth probe for /connect).
//   • openLiveTranscriptionSocket — opens the listen WebSocket (wss://api.deepgram.com/v1/listen)
//                                   with the key passed as the `token` subprotocol (browser/undici
//                                   WebSocket can't set Authorization headers; Deepgram accepts the
//                                   key via Sec-WebSocket-Protocol: token, <key>).
//   • parseDeepgramResult     — normalize a live "Results" message into a TranscriptChunk.
//
// Runtime note: the live socket is long-lived and belongs in the always-on Modal runtime, not a
// Vercel serverless function (which can't hold a socket open across a meeting). MP-CORE-3 places the
// execution. This foundation lane ships the primitive; the global WebSocket it uses is present in the
// Node 24 production runtime.

import {
  DeepgramResultSchema,
  LiveTranscriptionOptionsSchema,
  type LiveTranscriptionOptions,
  type TranscriptChunk,
} from "./types";
import { log } from "./log";

const REST_BASE = "https://api.deepgram.com";
const LISTEN_WS_BASE = "wss://api.deepgram.com/v1/listen";

export type DeepgramResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; authError: boolean };

/**
 * Validate a Deepgram API key for the /connect flow by listing the account's projects.
 * 200 → valid; 401/403 → rejected.
 */
export async function verifyApiKey(input: { apiKey: string }): Promise<DeepgramResult<true>> {
  let res: Response;
  try {
    res = await fetch(`${REST_BASE}/v1/projects`, {
      headers: { Authorization: `Token ${input.apiKey}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error: e instanceof Error ? e.message : "network error",
      authError: false,
    };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: res.status, error: "Deepgram rejected the API key.", authError: true };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text || `Deepgram error ${res.status}`, authError: false };
  }
  return { ok: true, data: true };
}

/** Build the listen WebSocket URL from options (booleans/ints → query params). */
export function buildListenUrl(options: LiveTranscriptionOptions): string {
  const params = new URLSearchParams({
    model: options.model,
    language: options.language,
    smart_format: String(options.smartFormat),
    interim_results: String(options.interimResults),
    diarize: String(options.diarize),
    endpointing: String(options.endpointing),
  });
  if (options.encoding) params.set("encoding", options.encoding);
  if (options.sampleRate) params.set("sample_rate", String(options.sampleRate));
  return `${LISTEN_WS_BASE}?${params.toString()}`;
}

export type LiveTranscriptionSocket = {
  socket: WebSocket;
  /** Forward an audio frame to Deepgram. */
  sendAudio: (chunk: ArrayBufferView | ArrayBuffer) => void;
  /** Signal end-of-audio so Deepgram flushes the final results, then the socket closes. */
  finish: () => void;
  /** Hard close. */
  close: () => void;
};

/**
 * Open a Deepgram live-transcription socket. The caller wires the message/error/close handlers on
 * the returned `.socket`; parse each message with {@link parseDeepgramResult}.
 */
export function openLiveTranscriptionSocket(input: {
  apiKey: string;
  options?: Partial<LiveTranscriptionOptions>;
}): LiveTranscriptionSocket {
  const options = LiveTranscriptionOptionsSchema.parse(input.options ?? {});
  const url = buildListenUrl(options);
  // Key travels as the `token` subprotocol (Deepgram-supported), since the WebSocket API has no way
  // to set an Authorization header on the handshake.
  const socket = new WebSocket(url, ["token", input.apiKey]);

  return {
    socket,
    sendAudio: (chunk) => {
      if (socket.readyState === socket.OPEN) socket.send(chunk);
    },
    finish: () => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: "CloseStream" }));
    },
    close: () => {
      try {
        socket.close();
      } catch (e) {
        log.warn("close: socket close threw", { error: e instanceof Error ? e.message : String(e) });
      }
    },
  };
}

/**
 * Normalize a raw Deepgram live message into a TranscriptChunk. Returns null for non-transcript
 * messages (Metadata, etc.) and for empty transcripts (silence/interim noise).
 */
export function parseDeepgramResult(raw: unknown): TranscriptChunk | null {
  const parsed = DeepgramResultSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  if (r.type && r.type !== "Results") return null;

  const alt = r.channel?.alternatives?.[0];
  const text = alt?.transcript?.trim() ?? "";
  if (!text) return null;

  const start = typeof r.start === "number" ? r.start : 0;
  const duration = typeof r.duration === "number" ? r.duration : 0;
  const speakerNum = alt?.words?.find((w) => typeof w.speaker === "number")?.speaker;

  return {
    text,
    confidence: typeof alt?.confidence === "number" ? alt.confidence : null,
    isFinal: r.is_final === true,
    startMs: Math.round(start * 1000),
    endMs: Math.round((start + duration) * 1000),
    speakerLabel: typeof speakerNum === "number" ? `speaker_${speakerNum}` : null,
  };
}
