// lib/channels/voice/realtime/cost.ts — cost accounting + the two hard per-call caps for the
// realtime engine (PA-CHAN-16).
//
// Two independent ceilings, both mandatory, both enforced on the session's own audio clock (the
// stream-loop precedent — no Date.now(), so the caps are deterministic and unit-tested):
//   • 30 minutes wall-clock  → auto-hangup with the graceful farewell.
//   • $5.00 realized cost    → same. Matches the Browser Agent per-run cap precedent.
//
// Cost basis: OpenAI Realtime usage events are authoritative when present (audio tokens priced
// per-minute-equivalent); between usage events the meter estimates from relayed audio seconds so a
// cap can't be outrun by a long single response. Twilio leg priced per minute of call time. All
// math in micro-cents (the pa_cost_events unit) — lossless below a cent.

import { logCostEvent } from "@/lib/cost/log";

const SECONDS_PER_MINUTE = 60;
const USD_TO_MICRO_CENTS = 1_000_000;
const MICRO_CENTS_PER_CENT = 10_000;

// Realtime audio pricing, per-minute at-cost estimates (spec: ~$0.06/min in, ~$0.24/min out).
const REALTIME_IN_USD_PER_MIN = 0.06;
const REALTIME_OUT_USD_PER_MIN = 0.24;
const TWILIO_USD_PER_MIN = 0.013;

// OpenAI audio tokens ≈ 10/second (both directions) — the token↔seconds bridge for usage events.
const AUDIO_TOKENS_PER_SECOND = 10;

/** Hard per-call caps (PA-CHAN-16). Exported so tests + the UI quote the same numbers. */
export const REALTIME_WALL_CAP_SECONDS = 30 * SECONDS_PER_MINUTE;
export const REALTIME_COST_CAP_MICRO_CENTS = 5 * 100 * 10_000; // $5.00

/** Per-owner daily call cap (inbound + outbound), overridable per connection config. */
export const DEFAULT_DAILY_CALL_CAP = 10;

export type RealtimeCapDecision =
  | { ok: true }
  | { ok: false; reason: "wall_cap" | "cost_cap" };

export type RealtimeCostSnapshot = {
  microCents: number;
  inboundAudioSeconds: number;
  outboundAudioSeconds: number;
};

/**
 * Accumulates the call's audio clock + realized cost. Pure state machine — the session feeds it
 * relayed frames and usage events; it answers "may this call continue?".
 */
export class RealtimeCostMeter {
  private inboundSeconds = 0;
  private outboundSeconds = 0;
  // Seconds already covered by an authoritative usage event (so estimates don't double-count).
  private settledInboundSeconds = 0;
  private settledOutboundSeconds = 0;
  private settledMicroCents = 0;

  /** Caller audio relayed toward OpenAI. */
  addInboundAudio(seconds: number): void {
    this.inboundSeconds += seconds;
  }

  /** Poc audio relayed back toward the caller. */
  addOutboundAudio(seconds: number): void {
    this.outboundSeconds += seconds;
  }

  /** Fold in an authoritative OpenAI usage event (response.done). */
  addUsage(inputAudioTokens: number, outputAudioTokens: number): void {
    const inSec = inputAudioTokens / AUDIO_TOKENS_PER_SECOND;
    const outSec = outputAudioTokens / AUDIO_TOKENS_PER_SECOND;
    this.settledInboundSeconds += inSec;
    this.settledOutboundSeconds += outSec;
    this.settledMicroCents += audioMicroCents(inSec, REALTIME_IN_USD_PER_MIN);
    this.settledMicroCents += audioMicroCents(outSec, REALTIME_OUT_USD_PER_MIN);
  }

  /** The call's elapsed audio clock in seconds (wall-cap basis — max leg, caller and Poc overlap). */
  get elapsedSeconds(): number {
    return Math.max(this.inboundSeconds, this.outboundSeconds);
  }

  /** Realized cost: settled usage + estimate for not-yet-settled relayed audio + the Twilio leg. */
  snapshot(): RealtimeCostSnapshot {
    const unsettledIn = Math.max(0, this.inboundSeconds - this.settledInboundSeconds);
    const unsettledOut = Math.max(0, this.outboundSeconds - this.settledOutboundSeconds);
    const microCents =
      this.settledMicroCents +
      audioMicroCents(unsettledIn, REALTIME_IN_USD_PER_MIN) +
      audioMicroCents(unsettledOut, REALTIME_OUT_USD_PER_MIN) +
      audioMicroCents(this.elapsedSeconds, TWILIO_USD_PER_MIN);
    return {
      microCents: Math.round(microCents),
      inboundAudioSeconds: this.inboundSeconds,
      outboundAudioSeconds: this.outboundSeconds,
    };
  }

  /** Evaluate both hard caps. Wall cap first (cheaper to explain on the call). */
  evaluateCaps(): RealtimeCapDecision {
    if (this.elapsedSeconds >= REALTIME_WALL_CAP_SECONDS) return { ok: false, reason: "wall_cap" };
    if (this.snapshot().microCents >= REALTIME_COST_CAP_MICRO_CENTS) {
      return { ok: false, reason: "cost_cap" };
    }
    return { ok: true };
  }
}

function audioMicroCents(seconds: number, usdPerMinute: number): number {
  return (seconds / SECONDS_PER_MINUTE) * usdPerMinute * USD_TO_MICRO_CENTS;
}

/** µ-law is 8000 bytes/second (8 kHz, 1 byte per sample); base64 expands 4/3. Pure + tested. */
export function mulawBase64Seconds(base64Payload: string): number {
  const bytes = Math.floor((base64Payload.length * 3) / 4);
  return bytes / 8000;
}

/** Fallback estimate from billed call duration (caller/Poc audio split 50/50) — the status
 * callback's basis when the bridge didn't finalize with exact per-leg seconds. */
export function estimateRealtimeCallMicroCents(durationSeconds: number): number {
  const half = durationSeconds / 2;
  return Math.round(
    audioMicroCents(half, REALTIME_IN_USD_PER_MIN) +
      audioMicroCents(half, REALTIME_OUT_USD_PER_MIN) +
      audioMicroCents(durationSeconds, TWILIO_USD_PER_MIN),
  );
}

/**
 * Write the per-call summary cost event for a realtime call (featureSlug 'voice_call' — flows
 * through Credits + Top Ups at Studio+, PA-POS-30). Same idempotency key as the v1 summary writer
 * so whichever of the bridge / status callback lands first wins and a retry collapses. Returns the
 * total in cents for pa_voice_calls.cost_cents.
 */
export async function logRealtimeCallSummaryCost(args: {
  ownerId: string;
  callSid: string;
  microCents: number;
}): Promise<number> {
  await logCostEvent({
    ownerId: args.ownerId,
    featureSlug: "voice_call",
    backend: "twilio+openai-realtime",
    model: "gpt-realtime",
    costMicroCents: args.microCents,
    idempotencyKey: `voice_call:${args.callSid}:summary`,
    metadata: { engine: "realtime_v2" },
  });
  return args.microCents / MICRO_CENTS_PER_CENT;
}
