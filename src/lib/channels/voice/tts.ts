// lib/channels/voice/tts.ts — ElevenLabs TTS for the outbound (text → caller) leg.
//
// The spec's target is ElevenLabs streaming (WS /stream-input). v0.1 ships the transport-agnostic
// primitives + an HTTP synthesis path so the loop runs without the `ws` package (not in the repo —
// the bidirectional WS service is documented separately in the handoff, where it swaps synthesizeSpeech
// for the /stream-input socket for lower first-syllable latency). Everything here is unit-tested.
//
// Pipeline: synthesize PCM-16 @ 16 kHz from ElevenLabs (model eleven_turbo_v2) → downsample to 8 kHz →
// µ-law encode (audio.ts) → split into 20 ms (160-byte) frames, base64-encoded, ready to write as
// Twilio Media Stream `media` messages. "Transcode response to µ-law" (spec build-step 4) is the
// downsample + encode step here; ElevenLabs has no native pcm_8000 output, so we take pcm_16000 and
// downsample.

import { pcm16ToMuLaw } from "./audio";

const ELEVENLABS_MODEL = "eleven_turbo_v2";
const ELEVENLABS_TTS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";
const SOURCE_SAMPLE_RATE = 16_000;
const TWILIO_SAMPLE_RATE = 8_000;
// 20 ms of 8 kHz µ-law = 160 bytes — one Twilio `media` frame.
const TWILIO_FRAME_BYTES = (TWILIO_SAMPLE_RATE / 1000) * 20;

/**
 * Downsample little-endian PCM-16 by an integer factor with a box filter (average each group) to blunt
 * aliasing. 16 kHz → 8 kHz is factor 2. Pure.
 */
export function downsamplePcm16(pcm: Buffer, fromRate: number, toRate: number): Buffer {
  if (toRate <= 0 || fromRate <= 0 || fromRate % toRate !== 0) {
    throw new Error(`downsamplePcm16: fromRate (${fromRate}) must be an integer multiple of toRate (${toRate})`);
  }
  const factor = fromRate / toRate;
  if (factor === 1) return pcm;
  const inSamples = Math.floor(pcm.length / 2);
  const outSamples = Math.floor(inSamples / factor);
  const out = Buffer.allocUnsafe(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += pcm.readInt16LE((i * factor + j) * 2);
    out.writeInt16LE(Math.round(sum / factor), i * 2);
  }
  return out;
}

/** PCM-16 @ 16 kHz → µ-law @ 8 kHz (the Twilio Media Stream payload codec). Pure. */
export function pcm16kToTwilioMuLaw(pcm16k: Buffer): Buffer {
  const pcm8k = downsamplePcm16(pcm16k, SOURCE_SAMPLE_RATE, TWILIO_SAMPLE_RATE);
  return pcm16ToMuLaw(pcm8k);
}

/** Split a µ-law buffer into base64 20 ms frames for Twilio `media` messages. Pure. */
export function frameMuLawForTwilio(mulaw: Buffer): string[] {
  const frames: string[] = [];
  for (let off = 0; off < mulaw.length; off += TWILIO_FRAME_BYTES) {
    frames.push(mulaw.subarray(off, off + TWILIO_FRAME_BYTES).toString("base64"));
  }
  return frames;
}

export type SynthesizeFn = (text: string, voiceId: string) => Promise<Buffer>;

/**
 * Production SynthesizeFn: POST text to ElevenLabs and return PCM-16 @ 16 kHz. Uses eleven_turbo_v2 for
 * low-latency speech. Throws on a non-OK response (no silent catch).
 */
export function elevenLabsSynthesize(apiKey: string): SynthesizeFn {
  return async (text: string, voiceId: string): Promise<Buffer> => {
    const url = `${ELEVENLABS_TTS_BASE}/${encodeURIComponent(voiceId)}?output_format=pcm_16000`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/pcm",
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ElevenLabs TTS failed (${res.status}): ${body.slice(0, 300)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  };
}

export type SpokenAudio = {
  /** Base64 20 ms µ-law frames, in order, ready to write to the Twilio Media Stream. */
  frames: string[];
  /** Total spoken-audio duration in seconds (for cost + cap accounting). */
  audioSeconds: number;
};

/**
 * Turn reply text into Twilio-ready spoken audio frames: synthesize (ElevenLabs) → transcode to µ-law
 * → frame. The synthesize step is injected so the framing pipeline is unit-tested without a live API.
 */
export async function speak(text: string, voiceId: string, synthesize: SynthesizeFn): Promise<SpokenAudio> {
  const pcm16k = await synthesize(text, voiceId);
  const mulaw = pcm16kToTwilioMuLaw(pcm16k);
  const frames = frameMuLawForTwilio(mulaw);
  const audioSeconds = mulaw.length / TWILIO_SAMPLE_RATE;
  return { frames, audioSeconds };
}
