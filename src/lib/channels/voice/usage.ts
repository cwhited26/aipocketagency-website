// lib/channels/voice/usage.ts — resolve an owner's remaining voice ceiling for a call by combining
// their month/day usage (calls-store) with their tier caps (lib/tiers/voice). The stream loop calls
// resolveVoiceCeiling on answer to get the hard second-ceiling it enforces.

import { type Tier } from "@/lib/personas/tier-caps";
import { computeVoiceCallCeilingSeconds, type VoiceCeiling } from "@/lib/tiers/voice";
import { sumVoiceSecondsSince } from "./calls-store";

/** Start of the UTC calendar month for `now`, as an ISO string. Pure. */
export function startOfUtcMonthIso(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Start of the UTC day for `now`, as an ISO string. Pure. */
export function startOfUtcDayIso(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

const SECONDS_PER_MINUTE = 60;

/**
 * Resolve the hard per-call second-ceiling for an owner: read this month's + today's completed-call
 * seconds, convert to minutes, and fold them through the tier caps. perCallMaxSeconds is the owner's
 * own-number configured max (null = shared pool → the 3-minute trial cap applies).
 */
export async function resolveVoiceCeiling(args: {
  ownerId: string;
  tier: Tier;
  perCallMaxSeconds: number | null;
  now: Date;
}): Promise<VoiceCeiling> {
  const [monthSeconds, daySeconds] = await Promise.all([
    sumVoiceSecondsSince(args.ownerId, startOfUtcMonthIso(args.now)),
    sumVoiceSecondsSince(args.ownerId, startOfUtcDayIso(args.now)),
  ]);
  return computeVoiceCallCeilingSeconds({
    tier: args.tier,
    usedThisMonthMinutes: monthSeconds / SECONDS_PER_MINUTE,
    usedTodayMinutes: daySeconds / SECONDS_PER_MINUTE,
    perCallMaxSeconds: args.perCallMaxSeconds,
  });
}
