// lib/tiers/voice.ts — Voice Call channel tier gating (spec §cost-model tier table).
//
// Voice is the most expensive surface PA runs (~$0.24/min at cost), so it's metered hard. Unlike the
// generic Channels Gateway gate (tierAllowsChannel, which is Slack=Pro+ / others=Pro+), EVERY tier
// gets some voice — the cheap tiers on a shared pool with a low monthly ceiling, the upper tiers with
// their own number and a high/unlimited ceiling. Reuses the canonical Tier ladder + rank from
// personas/tier-caps so there is one source of truth for what a tier is.
//
//   Tier (price)            | Monthly min | Own number | Custom voice id | Daily cap
//   ------------------------|-------------|------------|-----------------|----------
//   starter      ($37)      |     10      |  shared    |       no        |    —
//   pro          ($97)      |     60      |  shared    |       no        |    —
//   pro_plus     ($149)     |    300      |  own       |       no        |    —
//   studio       ($297)     |    300      |  own       |       no        |    —
//   studio_plus  ($497)     |  unlimited  |  own       |      yes        |  60 min
//   enterprise              |  unlimited  |  own       |      yes        |  60 min
//
// The spec's named tiers (Personal Brain / Business Agent / AI Agent Workspace / Studio+) map to the
// code ladder by price: $37→starter, $97→pro, $149/$297→own-number tiers, $497+→unlimited. "10/60/300/
// unlimited" and the "daily 60-min rate cap on Studio+" come straight from the task.

import { type Tier, tierRank } from "@/lib/personas/tier-caps";

// null = unlimited (rate-capped by the daily cap below, not the monthly one).
export const VOICE_MONTHLY_MINUTE_CAPS: Record<Tier, number | null> = {
  starter: 10,
  pro: 60,
  pro_plus: 300,
  studio: 300,
  studio_plus: null,
  enterprise: null,
};

// Daily minute rate-cap. Only the unlimited tiers carry one (spec: "Unlimited, rate-capped 60 min/day").
// null = no separate daily cap (the monthly cap governs).
export const VOICE_DAILY_MINUTE_CAPS: Record<Tier, number | null> = {
  starter: null,
  pro: null,
  pro_plus: null,
  studio: null,
  studio_plus: 60,
  enterprise: 60,
};

// Trial / shared-pool per-call ceiling (spec §setup-flow trial flow): a shared PA pool number caps
// each call at 3 minutes. Owners with their own number use their connection's configured max instead.
export const SHARED_POOL_PER_CALL_SECONDS = 180;

/** Every tier can use voice — the cheapest gets 10 min/mo on the shared pool (spec tier table). */
export function tierCanUseVoice(): boolean {
  return true;
}

/** Can this tier provision its OWN Twilio number (vs the shared pool)? Pro+ ("Workspace+") and up. */
export function tierAllowsOwnVoiceNumber(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("pro_plus");
}

/** Can this tier enter a custom ElevenLabs voice id (beyond the curated 12)? Studio+ and up. */
export function tierAllowsCustomVoiceId(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("studio_plus");
}

/** This tier's monthly minute cap (null = unlimited). */
export function voiceMonthlyMinuteCap(tier: Tier): number | null {
  return VOICE_MONTHLY_MINUTE_CAPS[tier];
}

/** This tier's daily minute rate-cap (null = none; the monthly cap governs). */
export function voiceDailyMinuteCap(tier: Tier): number | null {
  return VOICE_DAILY_MINUTE_CAPS[tier];
}

export type VoiceCeilingInput = {
  tier: Tier;
  /** Voice minutes already used this calendar month (seconds → minutes, by the caller). */
  usedThisMonthMinutes: number;
  /** Voice minutes already used today. */
  usedTodayMinutes: number;
  /** The connection's configured per-call max in seconds (own-number owners); null = shared pool. */
  perCallMaxSeconds: number | null;
};

export type VoiceCeiling = {
  /** Hard ceiling in SECONDS for THIS call. 0 means the cap is already exhausted — refuse the call. */
  allowedSeconds: number;
  /** Which limit set the ceiling — for the cap-hangup message + logs. */
  limitedBy: "monthly" | "daily" | "per_call" | "none";
};

const SECONDS_PER_MINUTE = 60;

/**
 * Pure: compute the hard second-ceiling for a single voice call given the tier and the owner's usage
 * so far. The stream loop enforces this — when the call's elapsed time reaches it, it sends the TwiML
 * cap-hangup (CAP_HANGUP_REPLY) and ends the call. Takes the min of every applicable limit:
 *   • remaining monthly minutes (skipped when unlimited),
 *   • remaining daily minutes (only the unlimited tiers have one),
 *   • the per-call max (shared-pool trial = 180s; own-number owners' configured max).
 * Returns 0 (refuse) when any cap is already exhausted.
 */
export function computeVoiceCallCeilingSeconds(input: VoiceCeilingInput): VoiceCeiling {
  const candidates: { seconds: number; limitedBy: VoiceCeiling["limitedBy"] }[] = [];

  const monthly = VOICE_MONTHLY_MINUTE_CAPS[input.tier];
  if (monthly !== null) {
    const remainingMin = Math.max(0, monthly - input.usedThisMonthMinutes);
    candidates.push({ seconds: remainingMin * SECONDS_PER_MINUTE, limitedBy: "monthly" });
  }

  const daily = VOICE_DAILY_MINUTE_CAPS[input.tier];
  if (daily !== null) {
    const remainingMin = Math.max(0, daily - input.usedTodayMinutes);
    candidates.push({ seconds: remainingMin * SECONDS_PER_MINUTE, limitedBy: "daily" });
  }

  const perCall = input.perCallMaxSeconds ?? SHARED_POOL_PER_CALL_SECONDS;
  candidates.push({ seconds: Math.max(0, perCall), limitedBy: "per_call" });

  if (candidates.length === 0) return { allowedSeconds: 0, limitedBy: "none" };

  let best = candidates[0];
  for (const c of candidates) {
    if (c.seconds < best.seconds) best = c;
  }
  return { allowedSeconds: best.seconds, limitedBy: best.limitedBy };
}
