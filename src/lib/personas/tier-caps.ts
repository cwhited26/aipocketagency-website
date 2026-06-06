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
  fetchSubscriptionTier,
  fetchUsageMonthly,
} from "./db";
import type { PersonaMode } from "./types";

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

/** Rank a tier for "highest wins" comparisons (starter=0 … enterprise=5). */
export function tierRank(tier: Tier): number {
  return TIERS.indexOf(tier);
}

// ── Stripe LIVE-mode price → tier mapping (PA-ORCH-10 unified SMB ladder) ────────────
//
// Source of truth for the SMB subscription tier a paid Stripe price grants. The
// Stripe webhook (src/app/api/stripe/webhook/route.ts) extracts the active price ID
// from a customer.subscription.* event and runs it through getTierFromStripePriceId to
// decide what tier to write to the customer's pocket_agent_subscriptions row.
//
// Kept as an exported, typed Record so the mapping is grep-able and unit-tested. Enterprise
// has no Stripe price (it's a "talk to sales" mailto), so it never appears here. The dev
// GTM add-ons (PA Sync / PA Publish, SPEC v4 Wave 3) are orthogonal yearly products — they
// are NOT SMB tiers, so they live in ADDON_PRICE_IDS below, not here.
export const PRICE_TO_TIER: Record<string, Tier> = {
  // Starter $37/mo — pre-existing, also referenced via STRIPE_POCKET_AGENT_PRICE_ID.
  price_1TdyfmJ6S5nx9HK5EeAZQEPj: "starter",
  // Pro $97/mo
  price_1TfRbIJ6S5nx9HK5sucoD8sB: "pro",
  // Pro+ $149/mo
  price_1TfRbJJ6S5nx9HK5ldFrZv5o: "pro_plus",
  // Studio $297/mo
  price_1TfRbKJ6S5nx9HK5g3U1yYOK: "studio",
  // Studio+ $497/mo
  price_1TfRbLJ6S5nx9HK54VQ2nc0m: "studio_plus",
};

/** Map a Stripe price ID to its SMB tier. Unknown prices default to 'starter'. */
export function getTierFromStripePriceId(priceId: string): Tier {
  return PRICE_TO_TIER[priceId] ?? "starter";
}

/**
 * Given the set of active price IDs on a subscription (a subscription can carry
 * multiple line items), return the highest SMB tier among them, or null if none of
 * the prices are SMB-ladder prices. Used by the webhook to pick the primary tier when
 * a customer stacks line items, and to ignore add-on-only subscriptions for tier writes.
 */
export function highestTierFromPriceIds(priceIds: readonly string[]): Tier | null {
  let best: Tier | null = null;
  for (const id of priceIds) {
    const tier = PRICE_TO_TIER[id];
    if (!tier) continue;
    if (best === null || tierRank(tier) > tierRank(best)) best = tier;
  }
  return best;
}

// ── Dev GTM add-on prices (SPEC v4 Wave 3) — orthogonal to the SMB tier ──────────────
//
// PA Sync ($96/yr) and PA Publish ($200/yr) are sold separately (today on getpa.dev).
// A customer can hold one of these alongside any SMB tier; the webhook treats them as
// boolean add-on flags on the subscription row and never lets them overwrite the SMB tier.
export const ADDON_PRICE_IDS = {
  sync: "price_1TfRmxJ6S5nx9HK5SoqFHdOY",
  publish: "price_1TfRmyJ6S5nx9HK5R9uxFpgd",
} as const;
export type AddonProduct = keyof typeof ADDON_PRICE_IDS;

/** Map a Stripe price ID to a dev add-on product, or null if it isn't one. */
export function getAddonFromStripePriceId(priceId: string): AddonProduct | null {
  for (const key of Object.keys(ADDON_PRICE_IDS) as AddonProduct[]) {
    if (ADDON_PRICE_IDS[key] === priceId) return key;
  }
  return null;
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

// ── Mode availability per tier (Wave 2, SPEC v3 §10) ────────────────────────────────

// Base sharing modes each tier ships with (before a la carte add-ons). Public + widget
// are gated above Pro for margin protection.
export const TIER_MODES: Record<Tier, PersonaMode[]> = {
  starter: [],
  pro: ["internal_team"],
  pro_plus: ["internal_team", "public_link"], // 1 public persona included
  studio: ["internal_team", "public_link", "widget"],
  studio_plus: ["internal_team", "public_link", "widget"],
  enterprise: ["internal_team", "public_link", "widget"],
};

// A la carte add-ons (SPEC v3 §10) for Pro / Pro+ owners who want a single public or
// widget persona without jumping to Studio. Add-on entitlements are not yet tracked in
// the DB (no Stripe price→entitlement mapping this lane), so canUseMode takes an optional
// explicit add-on set; the UI surfaces these as upgrade CTAs.
export const ADDONS = {
  public_persona: { mode: "public_link" as PersonaMode, priceMonthly: 19, label: "+1 public persona" },
  widget_persona: { mode: "widget" as PersonaMode, priceMonthly: 29, label: "+1 widget persona" },
} as const;
export type AddonKey = keyof typeof ADDONS;

/** Tiers that may remove the "Built with Pocket Agent" badge (white-label). */
export function badgeRemovableForTier(tier: Tier): boolean {
  return tier === "studio" || tier === "studio_plus" || tier === "enterprise";
}

/** Pure: can this tier (plus any purchased add-ons) publish a persona in `mode`? */
export function evaluateCanUseMode(
  tier: Tier,
  mode: PersonaMode,
  addons: AddonKey[] = [],
): CapDecision {
  if (TIER_MODES[tier].includes(mode)) return { ok: true, reason: "" };
  if (addons.some((k) => ADDONS[k].mode === mode)) return { ok: true, reason: "" };
  if (mode === "public_link") {
    return {
      ok: false,
      reason:
        "Public links are a Studio feature. Upgrade to Studio, or add a single public persona to your plan (+$19/mo).",
    };
  }
  if (mode === "widget") {
    return {
      ok: false,
      reason:
        "The website widget is a Studio feature. Upgrade to Studio, or add a single widget persona to your plan (+$29/mo).",
    };
  }
  return { ok: false, reason: "This sharing mode isn't available on your plan." };
}

export async function canUseMode(
  businessId: string,
  mode: PersonaMode,
): Promise<CapDecision> {
  const tier = await getCurrentTier(businessId);
  return evaluateCanUseMode(tier, mode);
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
  // Prefer the explicit tier written by the Stripe webhook (PA-ORCH-10). It's a
  // best-effort read that returns null if the column isn't present yet (pre-migration
  // 020) or no tier has been provisioned — in which case we fall back to the legacy
  // status→pro mapping so behavior is unchanged until the column is populated.
  const tier = await fetchSubscriptionTier(businessId);
  if (tier && isTier(tier)) return tier;
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
