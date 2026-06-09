// transcribe.ts — transcribe a podcast episode's audio enclosure with Whisper.
//
// Reuses the shared voice-memo Whisper call (lib/voice/transcribe.ts) — one transcription integration
// for the whole product (PA-PC principle). Podcasts are audio-native (no free caption track like
// YouTube), so Whisper is the primary path, not a fallback.
//
// Cost + abuse ceilings, all surfaced (never silent):
//   • Duration cap (PA-PC-6): skip episodes over 120 min unless allowLong.
//   • Enclosure size cap: reject anything over 100 MB BEFORE downloading (Content-Length header),
//     then again after download for feeds that lie about the header (PA-PC adversarial #1).
//   • SSRF guard: the enclosure URL is feed-supplied (untrusted) — reject non-http(s) and
//     private/loopback hosts before any fetch (PA-PC adversarial #2).
//   • Whisper's per-request limit is 25 MB; an episode over that is chunked (MP3 only — MP3 frames are
//     individually decodable, so byte-chunks transcribe; non-MP3 over the limit is refused honestly).

import { logCostFromUsage, type CostContext } from "@/lib/cost/log";
import { transcribeAudio, WHISPER_MAX_BYTES } from "@/lib/voice/transcribe";

/** Episodes longer than this skip Whisper unless allowLong is set (PA-PC-6 cost ceiling). */
export const MAX_EPISODE_DURATION_SECONDS = 120 * 60;
/** Hard cap on the audio file we'll download (PA-PC adversarial: oversized-audio defense). */
export const MAX_ENCLOSURE_BYTES = 100 * 1024 * 1024;
/** Chunk target stays just under Whisper's 25 MB per-request limit. */
const CHUNK_BYTES = WHISPER_MAX_BYTES - 1024 * 1024;

export type EpisodeTranscribeResult =
  | { ok: true; fullText: string; whisperMinutes: number }
  | {
      ok: false;
      reason: "too_long" | "too_large" | "unsafe_url" | "no_enclosure" | "download_failed" | "whisper_error" | "empty";
      message: string;
    };

/** Rejects non-http(s) and private/loopback enclosure hosts (SSRF defense). */
function isSafeEnclosureUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0" || host === "[::1]") return false;
  // IPv4 private / loopback / link-local ranges.
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)) {
      return false;
    }
  }
  return true;
}

function isMp3(enclosureType: string, url: string): boolean {
  return /mpeg|mp3/i.test(enclosureType) || /\.mp3(\?|$)/i.test(url);
}

/** Splits a buffer into ≤CHUNK_BYTES slices (used only when an MP3 exceeds Whisper's per-request limit). */
function chunkBuffer(buffer: Buffer): Buffer[] {
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < buffer.byteLength; offset += CHUNK_BYTES) {
    chunks.push(buffer.subarray(offset, Math.min(offset + CHUNK_BYTES, buffer.byteLength)));
  }
  return chunks;
}

/**
 * Transcribes one episode. Applies the duration + size + SSRF gates, downloads the enclosure, and runs
 * Whisper (chunked for long MP3s). Returns the transcript + billed minutes, or a typed reason the
 * caller surfaces to the owner. Never throws.
 */
export async function transcribeEpisode(params: {
  enclosureUrl: string;
  enclosureType: string;
  enclosureBytes: number;
  durationSeconds: number;
  allowLong: boolean;
  /** When set, one openai (Whisper) cost event is logged on a successful transcription. */
  cost?: CostContext;
}): Promise<EpisodeTranscribeResult> {
  const { enclosureUrl, enclosureType, durationSeconds, allowLong } = params;

  if (!enclosureUrl) {
    return { ok: false, reason: "no_enclosure", message: "That episode has no downloadable audio file in its feed." };
  }
  if (!isSafeEnclosureUrl(enclosureUrl)) {
    return { ok: false, reason: "unsafe_url", message: "The episode's audio link points somewhere I won't fetch." };
  }
  if (durationSeconds > MAX_EPISODE_DURATION_SECONDS && !allowLong) {
    const minutes = Math.round(durationSeconds / 60);
    return {
      ok: false,
      reason: "too_long",
      message: `This episode is ${minutes} minutes. I skipped transcription to keep costs down — ask again with "transcribe long" to override.`,
    };
  }
  // First size gate: the feed's declared length, before we download anything.
  if (params.enclosureBytes > MAX_ENCLOSURE_BYTES) {
    const mb = Math.round(params.enclosureBytes / (1024 * 1024));
    return {
      ok: false,
      reason: "too_large",
      message: `This episode's audio is ${mb} MB, over my 100 MB limit. I skipped it to keep costs down.`,
    };
  }

  // Second size gate: a HEAD check for feeds that omit enclosure@length but lie about it elsewhere.
  let headLength = 0;
  try {
    const head = await fetch(enclosureUrl, { method: "HEAD", cache: "no-store" });
    if (head.ok) headLength = Number(head.headers.get("content-length") ?? 0) || 0;
  } catch {
    // HEAD is best-effort — some CDNs reject it. The post-download check below is the real backstop.
    headLength = 0;
  }
  if (headLength > MAX_ENCLOSURE_BYTES) {
    const mb = Math.round(headLength / (1024 * 1024));
    return {
      ok: false,
      reason: "too_large",
      message: `This episode's audio is ${mb} MB, over my 100 MB limit. I skipped it to keep costs down.`,
    };
  }

  let audioRes: Response;
  try {
    audioRes = await fetch(enclosureUrl, { cache: "no-store" });
  } catch (e) {
    return { ok: false, reason: "download_failed", message: e instanceof Error ? e.message : "audio download failed" };
  }
  if (!audioRes.ok) {
    return { ok: false, reason: "download_failed", message: `audio download returned ${audioRes.status}` };
  }
  const buffer = Buffer.from(await audioRes.arrayBuffer());
  if (buffer.byteLength === 0) {
    return { ok: false, reason: "download_failed", message: "the audio download was empty" };
  }
  // Post-download backstop for a feed that lied about its size everywhere.
  if (buffer.byteLength > MAX_ENCLOSURE_BYTES) {
    const mb = Math.round(buffer.byteLength / (1024 * 1024));
    return { ok: false, reason: "too_large", message: `The downloaded audio is ${mb} MB, over my 100 MB limit.` };
  }

  const mime = enclosureType || (isMp3(enclosureType, enclosureUrl) ? "audio/mpeg" : "audio/mp4");
  const fileName = isMp3(enclosureType, enclosureUrl) ? "episode.mp3" : "episode.m4a";

  // Fits in one Whisper request — the common case.
  if (buffer.byteLength <= WHISPER_MAX_BYTES) {
    const result = await transcribeAudio({ buffer, fileName, mimeType: mime });
    if (!result.ok) return { ok: false, reason: "whisper_error", message: result.error };
    const whisperMinutes = minutesFor(durationSeconds, result.text);
    if (params.cost) await logCostFromUsage(params.cost, "openai", "whisper-1", { audioMinutes: whisperMinutes });
    return { ok: true, fullText: result.text, whisperMinutes };
  }

  // Over the per-request limit. Chunk MP3 (frame-decodable); refuse other containers honestly.
  if (!isMp3(enclosureType, enclosureUrl)) {
    return {
      ok: false,
      reason: "too_large",
      message:
        "This episode's audio is larger than the single-pass transcription limit and isn't an MP3, so I couldn't transcribe it in this version.",
    };
  }
  const chunks = chunkBuffer(buffer);
  const parts: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const result = await transcribeAudio({ buffer: chunks[i], fileName: `episode-${i + 1}.mp3`, mimeType: "audio/mpeg" });
    if (!result.ok) {
      return { ok: false, reason: "whisper_error", message: `Transcription failed on part ${i + 1}/${chunks.length}: ${result.error}` };
    }
    if (result.text) parts.push(result.text);
  }
  const fullText = parts.join(" ").trim();
  if (!fullText) return { ok: false, reason: "empty", message: "Whisper found no speech in the audio." };
  const whisperMinutes = minutesFor(durationSeconds, fullText);
  if (params.cost) await logCostFromUsage(params.cost, "openai", "whisper-1", { audioMinutes: whisperMinutes });
  return { ok: true, fullText, whisperMinutes };
}

/** Minutes billed to Whisper: the episode duration when known, else estimated from transcript length. */
function minutesFor(durationSeconds: number, text: string): number {
  if (durationSeconds > 0) return Math.round((durationSeconds / 60) * 10) / 10;
  // ~150 spoken words/min, ~6 chars/word → chars / 900 ≈ minutes. Rounded to one decimal.
  return Math.round((text.length / 900) * 10) / 10;
}
