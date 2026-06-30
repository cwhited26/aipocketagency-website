// lib/channels/voice/stt.ts — Whisper streaming-mode batching for the inbound (caller → text) leg.
//
// Twilio Media Streams deliver 8 kHz µ-law frames (~20 ms each). We accumulate them into a single
// utterance buffer, tracking speech/silence with the RMS detector (audio.ts). A turn finalizes when
// trailing silence passes 800 ms (DEFAULT_SILENCE_CONFIG) OR the buffer reaches the window-full safety
// cap (so a caller who never pauses still gets transcribed) — spec §architecture: "1.5-second windows;
// emit on silence > 800ms or window-full". On finalize we transcode the whole utterance µ-law → PCM-16,
// wrap it as a WAV, and POST it once to OpenAI /v1/audio/transcriptions (model whisper-1). One Whisper
// call per turn (not per 20 ms frame) — no mid-word stitching, lower cost.
//
// The transcribe call is injected (TranscribeFn) so the accumulator is unit-tested without a live API.

import {
  DEFAULT_SILENCE_CONFIG,
  initialSilenceState,
  muLawToPcm16,
  pcm16Rms,
  stepSilence,
  type SilenceConfig,
  type SilenceState,
} from "./audio";

const TWILIO_SAMPLE_RATE = 8000;
const WHISPER_MODEL = "whisper-1";
const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";

// Window-full safety: finalize an utterance that has run this long without a pause (spec's "window-
// full"). Generous so normal speech finalizes on silence, not the cap.
export const DEFAULT_MAX_UTTERANCE_MS = 15_000;

/** Build a 44-byte canonical WAV (PCM, mono) header around a little-endian PCM-16 buffer. Pure. */
export function wrapPcm16AsWav(pcm: Buffer, sampleRate: number = TWILIO_SAMPLE_RATE): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.allocUnsafe(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export type TranscribeFn = (wav: Buffer) => Promise<string>;

/** Production TranscribeFn: POST a WAV to OpenAI Whisper. Throws on a non-OK response (no silent catch). */
export function whisperTranscribe(apiKey: string): TranscribeFn {
  return async (wav: Buffer): Promise<string> => {
    const form = new FormData();
    // Copy into a fresh Uint8Array (BlobPart) — a Node Buffer's ArrayBufferLike isn't a valid BlobPart.
    form.append("file", new Blob([Uint8Array.from(wav)], { type: "audio/wav" }), "audio.wav");
    form.append("model", WHISPER_MODEL);
    form.append("response_format", "text");
    const res = await fetch(OPENAI_TRANSCRIPTION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Whisper transcription failed (${res.status}): ${text.slice(0, 300)}`);
    }
    return text.trim();
  };
}

export type VoiceTranscriberOptions = {
  transcribe: TranscribeFn;
  silenceConfig?: SilenceConfig;
  maxUtteranceMs?: number;
};

export type TurnResult = {
  text: string;
  /** Audio duration of the finalized utterance, in seconds (for cost + usage metering). */
  audioSeconds: number;
};

/**
 * Accumulates µ-law frames into one utterance and finalizes a turn on silence (or the window-full cap).
 * Stateful but deterministic: addFrame folds the frame's RMS into the silence detector and returns
 * whether the turn is ready; takeTurn transcodes + transcribes the buffered audio and resets.
 */
export class VoiceTranscriber {
  private readonly transcribe: TranscribeFn;
  private readonly silenceConfig: SilenceConfig;
  private readonly maxUtteranceMs: number;
  private silence: SilenceState = initialSilenceState();
  private frames: Buffer[] = [];
  private bufferedMs = 0;

  constructor(opts: VoiceTranscriberOptions) {
    this.transcribe = opts.transcribe;
    this.silenceConfig = opts.silenceConfig ?? DEFAULT_SILENCE_CONFIG;
    this.maxUtteranceMs = opts.maxUtteranceMs ?? DEFAULT_MAX_UTTERANCE_MS;
  }

  /**
   * Add one µ-law frame. `frameMs` is its duration (Twilio default ~20 ms). Returns true when the turn
   * is ready to finalize (trailing silence ≥ threshold after speech, or the window-full cap is hit).
   */
  addFrame(mulawFrame: Buffer, frameMs: number): boolean {
    this.frames.push(mulawFrame);
    this.bufferedMs += frameMs;
    const rms = pcm16Rms(muLawToPcm16(mulawFrame));
    const { state, turnComplete } = stepSilence(this.silence, rms, frameMs, this.silenceConfig);
    this.silence = state;
    if (turnComplete) return true;
    // Window-full safety only matters once we've actually heard speech in this utterance.
    return state.hasSpeech && this.bufferedMs >= this.maxUtteranceMs;
  }

  /** Whether any speech has been buffered since the last takeTurn (avoids transcribing pure silence). */
  hasBufferedSpeech(): boolean {
    return this.silence.hasSpeech || this.frames.length > 0;
  }

  /**
   * Transcode + transcribe the buffered utterance, then reset. Returns the recognized text + the
   * utterance's audio duration. An empty buffer returns an empty turn without calling Whisper.
   */
  async takeTurn(): Promise<TurnResult> {
    if (this.frames.length === 0) return { text: "", audioSeconds: 0 };
    const mulaw = Buffer.concat(this.frames);
    const audioSeconds = mulaw.length / TWILIO_SAMPLE_RATE;
    this.reset();
    const pcm = muLawToPcm16(mulaw);
    const wav = wrapPcm16AsWav(pcm, TWILIO_SAMPLE_RATE);
    const text = await this.transcribe(wav);
    return { text, audioSeconds };
  }

  reset(): void {
    this.frames = [];
    this.bufferedMs = 0;
    this.silence = initialSilenceState();
  }
}
