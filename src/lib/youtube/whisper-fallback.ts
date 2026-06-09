// whisper-fallback.ts — transcribe a captionless video by pulling its audio and running OpenAI
// Whisper, the same transcription engine the voice-memo lane uses (lib/pa-voice + the transcribe
// route). This runs ONLY when transcript.ts returns null (no caption track).
//
// Why not yt-dlp: Vercel's serverless runtime has no yt-dlp binary and we can't shell out, so we use
// a pure-fetch path instead — resolve a progressive audio stream via YouTube's Innertube `player`
// endpoint (the ANDROID client returns direct, non-ciphered URLs for most videos), download the
// smallest audio-only track under Whisper's 25 MB limit, and POST it to whisper-1.
//
// Cost ceiling (PA-YT-4): Whisper is metered, so we SKIP videos longer than 30 minutes unless the
// caller passes allowLong. A skip is a typed result the caller surfaces to the owner — never silent.

import { logCostFromUsage, type CostContext } from "@/lib/cost/log";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

/** Videos longer than this skip Whisper unless allowLong is set (PA-YT-4 cost ceiling). */
export const WHISPER_MAX_DURATION_SECONDS = 30 * 60;
/** Whisper rejects uploads over 25 MB; we never download past this. */
export const WHISPER_MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// The long-lived public Innertube key shipped in the YouTube web client. It authorizes the player
// endpoint only (read-only stream resolution) and carries no account scope.
const INNERTUBE_KEY = "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w";
const INNERTUBE_PLAYER_URL = `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`;

export type WhisperFallbackResult =
  | { ok: true; full_text: string }
  | {
      ok: false;
      reason: "too_long" | "no_openai_key" | "no_audio_source" | "download_failed" | "whisper_error" | "empty";
      message: string;
    };

type AdaptiveFormat = {
  mimeType?: string;
  url?: string;
  signatureCipher?: string;
  cipher?: string;
  contentLength?: string;
  bitrate?: number;
};
type PlayerResponse = {
  streamingData?: { adaptiveFormats?: AdaptiveFormat[] };
  playabilityStatus?: { status?: string; reason?: string };
};

/** Resolves a directly-downloadable audio-only stream under the size cap, or null when none exists. */
async function resolveAudioStream(
  videoId: string,
): Promise<{ url: string; mimeType: string } | { error: string } | null> {
  let res: Response;
  try {
    res = await fetch(INNERTUBE_PLAYER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "com.google.android.youtube/19.09.37" },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "19.09.37",
            androidSdkVersion: 30,
            hl: "en",
          },
        },
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "player request failed" };
  }
  if (!res.ok) return { error: `player endpoint returned ${res.status}` };

  const data = (await res.json()) as PlayerResponse;
  if (data.playabilityStatus && data.playabilityStatus.status && data.playabilityStatus.status !== "OK") {
    return { error: data.playabilityStatus.reason ?? data.playabilityStatus.status };
  }

  const formats = (data.streamingData?.adaptiveFormats ?? []).filter(
    (f) => f.mimeType?.startsWith("audio/") && f.url && !f.signatureCipher && !f.cipher,
  );
  if (formats.length === 0) return null; // only ciphered/unavailable streams — can't pure-fetch

  // Smallest audio track that fits the Whisper cap, preferring the lowest bitrate (good enough for
  // speech, smallest download). Tracks whose declared contentLength exceeds the cap are dropped.
  const fitting = formats
    .filter((f) => {
      const len = Number(f.contentLength ?? 0);
      return len === 0 || len <= WHISPER_MAX_AUDIO_BYTES;
    })
    .sort((a, b) => (a.bitrate ?? 0) - (b.bitrate ?? 0));

  const chosen = fitting[0];
  if (!chosen?.url) return null;
  return { url: chosen.url, mimeType: chosen.mimeType ?? "audio/mp4" };
}

function whisperFilename(mimeType: string): string {
  if (mimeType.includes("webm")) return "audio.webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "audio.m4a";
  return "audio.mp4";
}

/**
 * Transcribes a captionless video via Whisper. Resolves a downloadable audio stream, downloads it
 * under the size cap, and POSTs it to whisper-1. Returns the transcript text, or a typed reason the
 * caller surfaces (cost-ceiling skip, no obtainable audio, Whisper error). Never throws.
 */
export async function transcribeYouTubeAudio(params: {
  videoId: string;
  durationSeconds: number | null;
  allowLong: boolean;
  openaiApiKey: string | null;
  /** When set, one openai (Whisper) cost event is logged on a successful transcription. */
  cost?: CostContext;
}): Promise<WhisperFallbackResult> {
  if (!params.openaiApiKey) {
    return {
      ok: false,
      reason: "no_openai_key",
      message: "This video has no captions and OPENAI_API_KEY isn't set, so I couldn't transcribe the audio.",
    };
  }

  if (
    params.durationSeconds !== null &&
    params.durationSeconds > WHISPER_MAX_DURATION_SECONDS &&
    !params.allowLong
  ) {
    const minutes = Math.round(params.durationSeconds / 60);
    return {
      ok: false,
      reason: "too_long",
      message: `This video is ${minutes} minutes and has no captions. I skipped audio transcription to keep costs down — ask again with "transcribe long videos" to override.`,
    };
  }

  const stream = await resolveAudioStream(params.videoId);
  if (stream === null) {
    return {
      ok: false,
      reason: "no_audio_source",
      message: "This video has no captions and its audio isn't directly downloadable, so I couldn't transcribe it.",
    };
  }
  if ("error" in stream) {
    return { ok: false, reason: "download_failed", message: `Couldn't resolve the audio stream: ${stream.error}` };
  }

  // Download the audio, hard-capping the read at the Whisper size limit.
  let audioRes: Response;
  try {
    audioRes = await fetch(stream.url, { cache: "no-store" });
  } catch (e) {
    return { ok: false, reason: "download_failed", message: e instanceof Error ? e.message : "audio download failed" };
  }
  if (!audioRes.ok) {
    return { ok: false, reason: "download_failed", message: `audio download returned ${audioRes.status}` };
  }
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  if (audioBuffer.byteLength === 0) {
    return { ok: false, reason: "download_failed", message: "the audio download was empty" };
  }
  if (audioBuffer.byteLength > WHISPER_MAX_AUDIO_BYTES) {
    return {
      ok: false,
      reason: "too_long",
      message: "The audio track is larger than Whisper's 25 MB limit, so I couldn't transcribe it.",
    };
  }

  // POST to Whisper (multipart, same shape as the voice-memo transcribe route).
  const upstream = new FormData();
  upstream.append(
    "file",
    new Blob([new Uint8Array(audioBuffer)], { type: stream.mimeType }),
    whisperFilename(stream.mimeType),
  );
  upstream.append("model", "whisper-1");

  let res: Response;
  try {
    res = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.openaiApiKey}` },
      body: upstream,
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, reason: "whisper_error", message: e instanceof Error ? e.message : "Whisper unreachable" };
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: false, reason: "whisper_error", message: detail.error?.message ?? `Whisper returned ${res.status}.` };
  }

  const data = (await res.json()) as { text?: string };
  const full_text = (data.text ?? "").trim();
  if (!full_text) return { ok: false, reason: "empty", message: "Whisper found no speech in the audio." };

  // Whisper billed by audio length — price off the video's known duration (0 when metadata lacked it).
  if (params.cost) {
    const audioMinutes = params.durationSeconds != null ? params.durationSeconds / 60 : 0;
    await logCostFromUsage(params.cost, "openai", "whisper-1", { audioMinutes });
  }

  return { ok: true, full_text };
}
