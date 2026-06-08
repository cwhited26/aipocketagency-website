// lib/voice/transcribe.ts — the OpenAI Whisper transcription call, shared by the in-browser voice
// memo route (/api/app/voice/transcribe) and the SMS connector's MMS-audio path. Direct REST to
// the Whisper API (no SDK). Never throws — returns a typed result so each caller maps it to its own
// surface (an HTTP status for the route, a transcript-or-skip for the SMS webhook).

// Whisper accepts up to 25 MB per request.
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

type WhisperResponse = { text?: string };
type WhisperError = { error?: { message?: string } };

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; status: number; error: string };

/**
 * Transcribe an audio clip with Whisper (whisper-1). `fileName` should carry an audio extension so
 * Whisper infers the container. Returns a 503 result when OPENAI_API_KEY is unset (graceful — voice
 * stays off until configured), a 413 when the clip exceeds Whisper's limit, and 422 when no speech
 * was detected.
 */
export async function transcribeAudio(args: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: "Transcription isn't configured yet. Set OPENAI_API_KEY to enable voice memos.",
    };
  }
  if (args.buffer.byteLength === 0) {
    return { ok: false, status: 400, error: "The recording was empty." };
  }
  if (args.buffer.byteLength > WHISPER_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `Recording too long (${(args.buffer.byteLength / 1_048_576).toFixed(1)} MB). Maximum is 25 MB.`,
    };
  }

  const upstream = new FormData();
  const blob = new Blob([new Uint8Array(args.buffer)], { type: args.mimeType || "audio/mpeg" });
  upstream.append("file", blob, args.fileName);
  upstream.append("model", "whisper-1");

  let res: Response;
  try {
    res = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
      cache: "no-store",
    });
  } catch (e) {
    return {
      ok: false,
      status: 502,
      error:
        e instanceof Error
          ? `Transcription service unreachable: ${e.message}`
          : "Transcription service unreachable.",
    };
  }

  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as WhisperError;
    const message = detail.error?.message ?? `Whisper returned ${res.status}.`;
    return { ok: false, status: 502, error: `Transcription failed: ${message}` };
  }

  const data = (await res.json()) as WhisperResponse;
  const text = (data.text ?? "").trim();
  if (!text) {
    return { ok: false, status: 422, error: "No speech was detected in the recording." };
  }
  return { ok: true, text };
}
