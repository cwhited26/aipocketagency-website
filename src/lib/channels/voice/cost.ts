// lib/channels/voice/cost.ts — the Voice Call cost breakdown + ledger summary writer (spec §cost-model,
// §cost-logging). Voice spans four providers; we record:
//   • per-turn dispatcher LLM rows — written by the conversation agent with featureSlug 'voice_call',
//     backend 'anthropic' (the authoritative LLM spend);
//   • one per-call SUMMARY row — featureSlug 'voice_call', backend 'twilio+elevenlabs+openai',
//     model 'whisper-1+eleven_turbo_v2+claude-sonnet-4-6', with the per-segment split in
//     metadata.cost_breakdown and the realized total in costMicroCents.
//
// The per-segment rates are the spec's at-cost estimates; the LLM line in the summary is an estimate
// (the per-turn anthropic rows are authoritative). pa_voice_calls.cost_cents stores the same total in
// cents. Pure math + one ledger write.

import { logCostEvent } from "@/lib/cost/log";

// USD per minute of voice (spec §cost-model).
const TWILIO_USD_PER_MIN = 0.013;
const WHISPER_USD_PER_MIN = 0.006;
const ELEVENLABS_USD_PER_MIN = 0.18;
const LLM_USD_PER_MIN_ESTIMATE = 0.04;

const SECONDS_PER_MINUTE = 60;
const USD_TO_CENTS = 100;
const CENTS_TO_MICRO_CENTS = 10_000;

export type CostBreakdownCents = {
  twilio_cents: number;
  whisper_cents: number;
  elevenlabs_cents: number;
  llm_cents: number;
  total_cents: number;
};

export type CallCostInput = {
  /** Total wall-clock call duration in seconds (the Twilio billing basis). */
  callSeconds: number;
  /** Caller audio sent to Whisper, in seconds (the inbound transcription basis). */
  whisperAudioSeconds: number;
  /** Synthesized speech returned to the caller, in seconds (the ElevenLabs basis). */
  ttsAudioSeconds: number;
};

/** Pure: compute the per-segment cost breakdown (cents) for one call from its durations. */
export function computeCallCostBreakdown(input: CallCostInput): CostBreakdownCents {
  const round = (cents: number): number => Math.round(cents * 1e6) / 1e6;
  const twilio = (input.callSeconds / SECONDS_PER_MINUTE) * TWILIO_USD_PER_MIN * USD_TO_CENTS;
  const whisper = (input.whisperAudioSeconds / SECONDS_PER_MINUTE) * WHISPER_USD_PER_MIN * USD_TO_CENTS;
  const elevenlabs = (input.ttsAudioSeconds / SECONDS_PER_MINUTE) * ELEVENLABS_USD_PER_MIN * USD_TO_CENTS;
  // LLM line is an estimate keyed to call duration; the per-turn anthropic rows are authoritative.
  const llm = (input.callSeconds / SECONDS_PER_MINUTE) * LLM_USD_PER_MIN_ESTIMATE * USD_TO_CENTS;
  const total = twilio + whisper + elevenlabs + llm;
  return {
    twilio_cents: round(twilio),
    whisper_cents: round(whisper),
    elevenlabs_cents: round(elevenlabs),
    llm_cents: round(llm),
    total_cents: round(total),
  };
}

/**
 * Write the per-call summary cost event (one row, featureSlug 'voice_call'). Idempotent on the Twilio
 * CallSid so a retried status callback collapses to one row. Returns the realized total in cents (for
 * pa_voice_calls.cost_cents). Never throws (logCostEvent swallows failures).
 */
export async function logVoiceCallSummaryCost(args: {
  ownerId: string;
  callSid: string;
  breakdown: CostBreakdownCents;
}): Promise<number> {
  await logCostEvent({
    ownerId: args.ownerId,
    featureSlug: "voice_call",
    backend: "twilio+elevenlabs+openai",
    model: "whisper-1+eleven_turbo_v2+claude-sonnet-4-6",
    costMicroCents: args.breakdown.total_cents * CENTS_TO_MICRO_CENTS,
    idempotencyKey: `voice_call:${args.callSid}:summary`,
    metadata: { cost_breakdown: JSON.stringify(args.breakdown) },
  });
  return args.breakdown.total_cents;
}
