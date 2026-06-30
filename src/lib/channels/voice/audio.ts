// lib/channels/voice/audio.ts — audio primitives for the voice loop, all pure + unit-tested.
//
// Twilio Media Streams carry 8 kHz G.711 µ-law (PCMU) audio, base64-framed over the WebSocket. Whisper
// wants linear PCM-16; ElevenLabs streaming TTS returns PCM (we request pcm_16000 / pcm_8000) which we
// transcode back to µ-law for the return leg. This module is the codec + a silence detector for
// turn-boundary detection. No I/O — the stream loop (stream-loop.ts) owns the sockets and calls these.
//
// µ-law is the ITU-T G.711 codec Twilio PCMU uses. This is the standard 16-bit implementation
// (BIAS 0x84, CLIP 32635, exponent lookup + per-segment base table — the wavefile.js form), operating
// directly on 16-bit linear samples. The codec is lossy by design (8-bit), so a round-trip is exact
// only within the µ-law quantization step for the sample's segment — the tests assert that bound, not
// bit-equality.

// ── G.711 µ-law codec ───────────────────────────────────────────────────────────────────────────

const BIAS = 0x84;
const CLIP = 32635;

// Exponent for the high byte of (|sample| + BIAS): exponent = position of the highest set bit, with
// indices 0–1 → 0, 2–3 → 1, 4–7 → 2, … 128–255 → 7. Precomputed once.
const ENCODE_EXPONENT = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    t[i] = i < 2 ? 0 : i < 4 ? 1 : i < 8 ? 2 : i < 16 ? 3 : i < 32 ? 4 : i < 64 ? 5 : i < 128 ? 6 : 7;
  }
  return t;
})();

// Per-segment decode base: BIAS*(2^exp) - BIAS for exp 0..7.
const DECODE_BASE = [0, 132, 396, 924, 1980, 4092, 8316, 16764] as const;

/** Encode one 16-bit linear PCM sample to an 8-bit µ-law byte (0–255). */
export function muLawEncodeSample(pcm: number): number {
  let sample = pcm < -32768 ? -32768 : pcm > 32767 ? 32767 : Math.round(pcm);
  const sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  const exponent = ENCODE_EXPONENT[(sample >> 7) & 0xff];
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/** Decode one 8-bit µ-law byte to a 16-bit linear PCM sample. */
export function muLawDecodeSample(uByte: number): number {
  const u = ~uByte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  const magnitude = DECODE_BASE[exponent] + (mantissa << (exponent + 3));
  return sign !== 0 ? -magnitude : magnitude;
}

/** Decode a µ-law byte buffer to a little-endian 16-bit PCM buffer (for Whisper). */
export function muLawToPcm16(mulaw: Buffer): Buffer {
  const out = Buffer.allocUnsafe(mulaw.length * 2);
  for (let i = 0; i < mulaw.length; i++) {
    out.writeInt16LE(muLawDecodeSample(mulaw[i]), i * 2);
  }
  return out;
}

/** Encode a little-endian 16-bit PCM buffer to a µ-law byte buffer (for the return leg to Twilio). */
export function pcm16ToMuLaw(pcm: Buffer): Buffer {
  const samples = Math.floor(pcm.length / 2);
  const out = Buffer.allocUnsafe(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = muLawEncodeSample(pcm.readInt16LE(i * 2));
  }
  return out;
}

// ── Silence detection (turn boundary) ─────────────────────────────────────────────────────────

/** RMS amplitude (0–32767) of a little-endian PCM-16 frame. 0 for an empty buffer. */
export function pcm16Rms(pcm: Buffer): number {
  const samples = Math.floor(pcm.length / 2);
  if (samples === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples; i++) {
    const s = pcm.readInt16LE(i * 2);
    sumSquares += s * s;
  }
  return Math.sqrt(sumSquares / samples);
}

export type SilenceConfig = {
  /** RMS below this counts as silence (≈ noise floor). Default 500 on the 0–32767 scale. */
  rmsThreshold: number;
  /** Trailing silence after speech that closes a turn. Default 800 ms (spec §architecture). */
  silenceMs: number;
};

export const DEFAULT_SILENCE_CONFIG: SilenceConfig = { rmsThreshold: 500, silenceMs: 800 };

export type SilenceState = {
  /** Whether speech has been heard since the last turn boundary. */
  hasSpeech: boolean;
  /** Consecutive trailing-silence milliseconds since the last speech frame. */
  trailingSilenceMs: number;
};

export function initialSilenceState(): SilenceState {
  return { hasSpeech: false, trailingSilenceMs: 0 };
}

export type SilenceStep = {
  state: SilenceState;
  /** True exactly when this frame closes a turn (speech was heard, then enough trailing silence). */
  turnComplete: boolean;
};

/**
 * Pure reducer: fold one frame's RMS level + duration into the silence state and report whether the
 * frame closes a turn. A turn closes when speech has been heard and trailing silence has reached the
 * configured threshold; the returned state is reset (hasSpeech=false) on a completed turn so the next
 * utterance starts clean.
 */
export function stepSilence(
  state: SilenceState,
  frameRms: number,
  frameMs: number,
  config: SilenceConfig = DEFAULT_SILENCE_CONFIG,
): SilenceStep {
  const isSpeech = frameRms >= config.rmsThreshold;
  if (isSpeech) {
    return { state: { hasSpeech: true, trailingSilenceMs: 0 }, turnComplete: false };
  }
  // Silence frame.
  if (!state.hasSpeech) {
    // Leading silence before any speech — ignore, don't accumulate toward a turn.
    return { state, turnComplete: false };
  }
  const trailing = state.trailingSilenceMs + frameMs;
  if (trailing >= config.silenceMs) {
    return { state: initialSilenceState(), turnComplete: true };
  }
  return { state: { hasSpeech: true, trailingSilenceMs: trailing }, turnComplete: false };
}
