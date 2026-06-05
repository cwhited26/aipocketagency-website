// tier-caps.ts — pricing-tier limits and enforcement (SPEC v3 §10, Success Criterion
// #5). Pure decision functions are split from DB I/O so the cap logic is unit-tested in
// isolation (lib/personas/__tests__/tier-caps.test.ts).
//
// Tier source (PA-PERSONA decision): PA has no per-tier column on
// pocket_agent_subscriptions yet, so getCurrentTier maps an active subscription to
// 'pro' (the Wave 1 Personas tier) and no subscription to 'starter'. An env override
// (PA_PERSONAS_DEFAULT_TIER) lets an operator promote an active subscriber to a higher
// tier before the Stripe price->tier mapping lands. Wired into the wizard + chat
// endpoint.

import {
  countPersonasForBusiness,
  countLiveSeatsForPersona,
  fetchPersona,
  fetchSubscriptionStatus,
  fetchUsageMonthly,
} from "./db";

export const TIERS = [
  "starter",
  "pro",
  "pro_plus",
  "studio",
  "studio_plus",
  "enterprise",
] as const;
export type Tier = (typeof TIERS)[number];

export function isTier(value: string): value is Tier {
  return (TIERS as readonly string[]).includes(value);
}

export type TierLimits = {
  // null = unlimited (fair use).
  personas: number | null;
  seatsPerPersona: number | null;
  messagesPerMonthPerPersona: number | null;
};

// SPEC v3 §10 pricing table.
export const TIER_LIMITS: Record<Tier, TierLimits> = {
  starter: { personas: 0, seatsPerPersona: 0, messagesPerMonthPerPersona: 0 },
  pro: { personas: 5, seatsPerPersona: 10, messagesPerMonthPerPersona: 2_000 },
  pro_plus: { personas: 10, seatsPerPersona: 25, messagesPerMonthPerPersona: 5_000 },
  studio: { personas: 20, seatsPerPersona: 50, messagesPerMonthPerPersona: 15_000 },
  studio_plus: {
    personas: 50,
    seatsPerPersona: null,
    messagesPerMonthPerPersona: 50_000,
  },
  enterprise: {
    personas: null,
    seatsPerPersona: null,
    messagesPerMonthPerPersona: null,
  },
};

export const TIER_LABELS: Record<Tier, string> = {
  starter: "Starter",
  pro: "Pro",
  pro_plus: "Pro+",
  studio: "Studio",
  studio_plus: "Studio+",
  enterprise: "Enterprise",
};

export type CapDecision = { ok: boolean; reason: string };

// ── Pure decision functions ─────────────────────────────────────────────────────────

/** yyyy-mm key for the given date (UTC) used as the usage-monthly partition. */
export function monthKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function evaluateCanCreatePersona(tier: Tier, currentCount: number): CapDecision {
  const limit = TIER_LIMITS[tier].personas;
  if (limit === null) return { ok: true, reason: "" };
  if (limit === 0) {
    return {
      ok: false,
      reason:
        "Personas are part of Pocket Agent Pro. Upgrade to Pro to create your first team agent.",
    };
  }
  if (currentCount >= limit) {
    return {
      ok: false,
      reason: `You're using all ${limit} personas on your plan. Upgrade to add more.`,
    };
  }
  return { ok: true, reason: "" };
}

export function evaluateCanInviteSeat(tier: Tier, currentSeatCount: number): CapDecision {
  const limit = TIER_LIMITS[tier].seatsPerPersona;
  if (limit === null) return { ok: true, reason: "" };
  if (limit === 0) {
    return { ok: false, reason: "Team seats require Pocket Agent Pro." };
  }
  if (currentSeatCount >= limit) {
    return {
      ok: false,
      reason: `This persona has all ${limit} seats filled. Upgrade for more seats per persona.`,
    };
  }
  return { ok: true, reason: "" };
}

export function evaluateCanSendMessage(
  tier: Tier,
  monthlyMessageCount: number,
): CapDecision {
  const limit = TIER_LIMITS[tier].messagesPerMonthPerPersona;
  if (limit === null) return { ok: true, reason: "" };
  if (limit === 0) {
    return { ok: false, reason: "This persona isn't available on the current plan." };
  }
  if (monthlyMessageCount >= limit) {
    return {
      ok: false,
      reason:
        "This persona has reached its monthly message limit. It'll resume next month — or upgrade to Studio to lift the cap.",
    };
  }
  return { ok: true, reason: "" };
}

/** Maps a subscription status + env override to a tier. Pure for testability. */
export function tierFromSubscription(
  status: string | null,
  envOverride: string | null,
): Tier {
  const hasActive = status === "active" || status === "trialing" || status === "trial";
  if (!hasActive) return "starter";
  if (envOverride && isTier(envOverride)) return envOverride;
  return "pro";
}

// ── Async wrappers (DB-backed) ──────────────────────────────────────────────────────

export async function getCurrentTier(businessId: string): Promise<Tier> {
  const status = await fetchSubscriptionStatus(businessId);
  return tierFromSubscription(status, process.env.PA_PERSONAS_DEFAULT_TIER ?? null);
}

export type PersonasUsage = {
  personasCount: number;
  totalMessageCountThisMonth: number;
};

export async function getPersonasUsage(businessId: string): Promise<PersonasUsage> {
  const personasCount = await countPersonasForBusiness(businessId);
  return { personasCount, totalMessageCountThisMonth: 0 };
}

export async function canCreatePersona(businessId: string): Promise<CapDecision> {
  const tier = await getCurrentTier(businessId);
  const count = await countPersonasForBusiness(businessId);
  return evaluateCanCreatePersona(tier, count);
}

export async function canInviteSeat(personaId: string): Promise<CapDecision> {
  const persona = await fetchPersona(personaId);
  if (!persona) return { ok: false, reason: "Persona not found." };
  const tier = await getCurrentTier(persona.business_id);
  const seatCount = await countLiveSeatsForPersona(personaId);
  return evaluateCanInviteSeat(tier, seatCount);
}

export async function canSendMessage(personaId: string): Promise<CapDecision> {
  const persona = await fetchPersona(personaId);
  if (!persona) return { ok: false, reason: "Persona not found." };
  const tier = await getCurrentTier(persona.business_id);
  const usage = await fetchUsageMonthly(personaId, monthKey());
  return evaluateCanSendMessage(tier, usage?.message_count ?? 0);
}
