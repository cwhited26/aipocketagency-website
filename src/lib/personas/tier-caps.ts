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

/**
 * Can this tier subscribe to a Lead Scout vertical pack? Packs are a Studio+/Enterprise add-on
 * (PA-LS-11) — lower tiers can browse the packs grid and see the upgrade path, but Subscribe only
 * fires at Studio+ and above.
 */
export function tierAllowsLeadScoutPacks(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("studio_plus");
}

/**
 * Can this tier subscribe to a podcast vertical curation pack (PA-PC-14)? Like the Lead Scout packs,
 * podcast packs are a Studio+/Enterprise add-on — lower tiers can browse the grid and see the upgrade
 * path, but Subscribe (which spins up a watch per show) only fires at Studio+ and above.
 */
export function tierAllowsPodcastPacks(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("studio_plus");
}

/**
 * Can this tier run the Signal Catcher (PA-SIGNAL-1)? Studio+ / Enterprise only — it spends a
 * Haiku classification on every owner chat message, so it sits with the other cost-bearing
 * always-on features (Lead Scout packs, podcast packs) and inside the PA-POS-30 credit allowance.
 * Note the Ritual Scheduler itself is NOT tier-locked (every tier holds rituals under the
 * PA-RITUAL-8 active caps); Signal Catcher is the metered layer above it.
 */
export function tierAllowsSignalCatcher(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("studio_plus");
}

/**
 * Can this tier use a given channel of the Channels Gateway (PA-CHAN-7 + the Phase 2–4 gates)? The
 * "your agent is wherever you work" pitch is the Business-Agent-and-up value tier in the v5 funnel:
 *   • Personal Brain ($37, `starter`) — channels OFF.
 *   • Business Agent ($97, `pro`)     — Slack, Telegram, SMS, WhatsApp (the shipped text channels).
 *   • AI Agent Workspace (`studio_plus`) and up — iMessage (self-hosted BlueBubbles relay; the
 *     power-user channel).
 *   • Pro+ ($149, `pro_plus`) and up  — every other (queued) channel.
 */
export function tierAllowsChannel(tier: Tier, channelSlug: string): boolean {
  // The shipped text channels unlock at Business Agent and up.
  if (
    channelSlug === "slack" ||
    channelSlug === "telegram" ||
    channelSlug === "sms" ||
    channelSlug === "whatsapp"
  ) {
    return tierRank(tier) >= tierRank("pro");
  }
  // iMessage rides the owner's own BlueBubbles Mac relay — Studio+ / Enterprise only.
  if (channelSlug === "imessage") return tierRank(tier) >= tierRank("studio_plus");
  // Every other (queued) channel is Pro+ and up.
  return tierRank(tier) >= tierRank("pro_plus");
}

/**
 * Should this tier even SEE the Channels surface (PA-CHAN-7)? Business Agent and up see it; the free
 * Personal Brain tier doesn't — channels stay off their settings entirely.
 */
export function tierCanSeeChannels(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("pro");
}

/**
 * Can this tier actually build a landing page (PA-LPB-4)? The Landing Page Builder is a Studio /
 * Studio+ / Enterprise App — it stands up a real GitHub repo + Vercel project + deploy on the owner's
 * accounts, so it sits with the other build-grade tooling. Pro / Pro+ see the card and the upgrade
 * path; Studio and above can fire a build.
 */
export function tierAllowsLandingPageBuilder(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("studio");
}

/**
 * Should this tier even SEE the Landing Page Builder card (PA-LPB-4)? Pro and above see it (with an
 * upgrade CTA below Studio); the free Starter tier doesn't — the card stays off their Apps grid.
 */
export function tierCanSeeLandingPageBuilder(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("pro");
}

/**
 * Can this tier run the Competitor Inspector (PA-CINS)? Pro+ and above — each capture is a real
 * headless browser run plus a model read, so it sits one rung above the entry Business Agent tier.
 * Every tier sees the App card; below Pro+ the surface shows the upgrade path instead of the form.
 */
export function tierAllowsCompetitorInspector(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("pro_plus");
}

/**
 * Should this tier even SEE the Idea Engine card (PA-IDEA-3)? The Idea Engine turns an idea into a
 * shipped MVP by chaining the build-grade Apps, so it's a Pro+ and above feature — Free and Pro don't
 * see it at all. Pro+ gets prompt-pack mode (stages 1–3 + prompts for 4–6).
 */
export function tierCanSeeIdeaEngine(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("pro_plus");
}

/**
 * Can this tier use the Idea Engine at all (PA-IDEA-3)? Same gate as visibility — Pro+ and above. Pro+
 * runs the full chain in prompt-pack mode; auto-build is gated separately below.
 */
export function tierAllowsIdeaEngine(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("pro_plus");
}

/**
 * Can this tier run the Idea Engine in AUTO-BUILD mode (PA-IDEA-2/3)? Auto-build ships the MVP + sales
 * page on the owner's own GitHub + Vercel via the Build Tools, so it sits with the other build-grade
 * tooling: Studio+ and Enterprise only. Pro+ falls back to prompt-pack mode (the prompts to run
 * elsewhere). The resolved mode is auto_build at Studio+, else prompt_pack.
 */
export function tierAllowsIdeaEngineAutoBuild(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("studio_plus");
}

/**
 * Can this tier actually connect Recall.ai + run the Meeting Persona App (MP-1)? Meeting Persona
 * bundles into Studio+ ($497) per the Builder Tier pricing pattern (BT-7) — it carries real
 * per-minute COGS (Recall bot runtime + transcription), so it sits with the build-grade tooling:
 * Studio / Studio+ / Enterprise. Pro / Pro+ see the card + upgrade path but can't connect.
 */
export function tierAllowsMeetingPersona(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("studio");
}

/**
 * Should this tier even SEE the Meeting Persona / Recall.ai card (MP-1)? Pro and above see it (with
 * an upgrade CTA below Studio); Free / Starter don't — the card stays off their Connections surface.
 */
export function tierCanSeeMeetingPersona(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("pro");
}

/**
 * How many of the 25 AI Workflow Vault recipes this tier unlocks for free (PA-VAULT-3). The Vault is
 * visible to every tier — Starter sees 3 unlocked and 22 locked behind an upgrade, Pro 5, Pro+ 10,
 * Studio 18, Studio+/Enterprise all 25. The $47 Workflow Vault order-bump unlocks all 25 regardless of
 * tier (checked separately via the owner's pocket_agent_addon_purchases row). The per-recipe
 * recommended_tier in src/data/workflow-vault/ drives which specific recipes unlock; this Record is the
 * authoritative count, asserted equal to the recipe distribution in the tests.
 */
export const WORKFLOW_VAULT_UNLOCK_COUNTS: Record<Tier, number> = {
  starter: 3,
  pro: 5,
  pro_plus: 10,
  studio: 18,
  studio_plus: 25,
  enterprise: 25,
};

/** This tier's free Workflow Vault unlock count (0 is never returned — every tier sees at least 3). */
export function workflowVaultUnlockCount(tier: Tier): number {
  return WORKFLOW_VAULT_UNLOCK_COUNTS[tier];
}

// Per-tier cap on LIVE persona memories, counted across ALL of an owner's Personas (SPEC §9, PA-MEM-6).
// null = unlimited (fair use). The cap is checked on the LEARN write path; over-cap, the
// lowest-importance live memory auto-supersedes rather than erroring. Superseded rows never count.
// (The lowest tier is 'starter' here — the SPEC's "Free" — and maps to 100.)
export const PERSONA_MEMORY_CAPS: Record<Tier, number | null> = {
  starter: 100,
  pro: 1_000,
  pro_plus: 1_000,
  studio: 10_000,
  studio_plus: 10_000,
  enterprise: null,
};

/** This tier's live-memory cap across all Personas (null = unlimited). */
export function personaMemoryCap(tier: Tier): number | null {
  return PERSONA_MEMORY_CAPS[tier];
}

// ── GHL Connector gating (Pocket Agent for GHL Agencies SPEC v1 §6, PA-GHL-6) ────────────────

/**
 * How many GHL client sub-accounts each tier syncs (PA-GHL-6, Option B pricing lock). The tier
 * ladder gains a per-client-cap axis instead of a separate Agency SKU: Pro+ runs 3 clients,
 * Studio 10, Studio+ 25, Enterprise uncapped (null). Starter/Pro carry 0 — the connector is
 * locked below Pro+, with the $50 / 7-day GHL Project Pass renting a 1-client proof-of-concept
 * to Business Agent (the pass cap lives in lib/ghl/entitlement.ts, not this record).
 * Enforcement is a soft cap in syncGhlLocations: locations past the cap register as
 * sync_state='over_cap' and the surface shows the upgrade math — education, never a hard error
 * (the PA-POS-31 posture).
 */
export const GHL_CLIENT_CAPS: Record<Tier, number | null> = {
  starter: 0,
  pro: 0,
  pro_plus: 3,
  studio: 10,
  studio_plus: 25,
  enterprise: null,
};

/** This tier's GHL client sub-account cap (null = uncapped, 0 = connector locked). */
export function ghlClientCap(tier: Tier): number | null {
  return GHL_CLIENT_CAPS[tier];
}

/** Does the tier itself include the GHL Connector (no Project Pass needed)? Pro+ and up. */
export function tierAllowsGhlConnector(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("pro_plus");
}

/**
 * Should this tier even SEE the GHL Connector surface? Business Agent (pro) and up — pro is
 * Project Pass eligible ($50 / 7 days, 1 client), so the card renders with the pass offer.
 * Starter (Personal Brain) gets the locked card with the upgrade CTA only.
 */
export function tierCanSeeGhlConnector(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("pro");
}

// ── Persona Soul System gating (Pocket_Agent_Soul_System_SPEC_v1 §Tier gating) ───────────────
//
// The Soul learns HOW to work with this owner (style, preferences, boundaries). Behaviour by tier:
//   • Personal Brain ($37, `starter`)  — reads only. Continuous extraction is OFF. The owner may
//                                          still add Soul attributes by hand.
//   • Business Agent ($97, `pro`/`pro_plus`) — opt-in extraction PER Persona (a Persona is "enabled"
//                                          once it holds at least one Soul attribute the owner seeded
//                                          or kept). Up to 25 active attributes per Persona.
//   • AI Agent Workspace ($497, `studio_plus`) — full extraction across all Personas, unlimited
//                                          attributes, Soul export.
//   • Studio / Studio+ / Enterprise    — cross-Persona Soul sharing (one owner-model across agents).
// The dollar anchors come straight from the SPEC; the in-between PA rungs (`pro_plus`, `studio`) are
// mapped monotonically so a higher price never grants less.
export type SoulExtractionMode = "off" | "opt_in" | "full";

const SOUL_EXTRACTION_MODES: Record<Tier, SoulExtractionMode> = {
  starter: "off",
  pro: "opt_in",
  pro_plus: "opt_in",
  studio: "full",
  studio_plus: "full",
  enterprise: "full",
};

/** This tier's continuous-extraction mode (SPEC §Tier gating). */
export function soulExtractionMode(tier: Tier): SoulExtractionMode {
  return SOUL_EXTRACTION_MODES[tier];
}

// Per-Persona cap on LIVE Soul attributes (null = unlimited). Business is 25 per the SPEC; the rest
// scale monotonically with the price ladder, Workspace ($497, studio_plus) and up being unlimited.
export const SOUL_ACTIVE_CAPS: Record<Tier, number | null> = {
  starter: 25,
  pro: 25,
  pro_plus: 25,
  studio: 100,
  studio_plus: null,
  enterprise: null,
};

/** This tier's per-Persona live Soul-attribute cap (null = unlimited). */
export function soulActiveCap(tier: Tier): number | null {
  return SOUL_ACTIVE_CAPS[tier];
}

/** Can this tier run the Haiku extractor at all (continuous OR the "Suggest improvements" box)? The
 *  read-only Personal tier never spends a model call on Soul extraction — it can only add by hand. */
export function tierAllowsSoulExtraction(tier: Tier): boolean {
  return soulExtractionMode(tier) !== "off";
}

/** Cross-Persona Soul sharing — Studio and up (SPEC §Tier gating). */
export function tierAllowsCrossPersonaSoul(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("studio");
}

/** Soul export for backup — the AI Agent Workspace ($497) feature and up (SPEC §Tier gating). */
export function tierAllowsSoulExport(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("studio_plus");
}

export type SoulExtractionDecision =
  | { allowed: true }
  | { allowed: false; reason: "read_only" | "opt_in_pending" };

/**
 * Pure: may CONTINUOUS (post-approval) extraction run for this Persona right now?
 *   • off    → never (read-only Personal tier).
 *   • opt_in → only when the Persona is enabled (it already holds ≥1 Soul attribute).
 *   • full   → always.
 * The explicit "Suggest improvements" box is a separate, deliberate owner action — it is gated only by
 * tierAllowsSoulExtraction, not by this opt-in (the owner is directly asking).
 */
export function resolveSoulExtraction(
  tier: Tier,
  ctx: { personaHasSoul: boolean },
): SoulExtractionDecision {
  const mode = soulExtractionMode(tier);
  if (mode === "off") return { allowed: false, reason: "read_only" };
  if (mode === "full") return { allowed: true };
  return ctx.personaHasSoul ? { allowed: true } : { allowed: false, reason: "opt_in_pending" };
}

/** Pure: may the owner add another live Soul attribute to this Persona, given the live count? Manual
 *  add is allowed on every tier (even read-only Personal); it's the cap that bites. */
export function evaluateCanAddSoulAttribute(tier: Tier, liveCount: number): CapDecision {
  const cap = soulActiveCap(tier);
  if (cap === null) return { ok: true, reason: "" };
  if (liveCount >= cap) {
    return {
      ok: false,
      reason: `This assistant's Soul is full at ${cap} attributes on your plan. Retire one, or upgrade for more.`,
    };
  }
  return { ok: true, reason: "" };
}

/**
 * Can this tier run a Decision Roundtable (PA-DR-1)? Three (or four) sub-agent runs per question is
 * 3-4× a normal chat's model spend, so the feature is Studio+/Enterprise only. Free/Pro tiers see a
 * non-actionable teaser inline in chat but can't fire the debate.
 */
export function tierAllowsDecisionRoundtable(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("studio_plus");
}

// Per-tier monthly Decision Roundtable run cap (adversarial §11: cost-runaway guard). 0 = tier can't
// run the feature at all. Studio+ ~30/mo, Enterprise ~150/mo; runs above the cap are refused honestly
// rather than metered-and-billed, keeping the premium gate legible.
export const DECISION_ROUNDTABLE_MONTHLY_CAPS: Record<Tier, number> = {
  starter: 0,
  pro: 0,
  pro_plus: 0,
  studio: 0,
  studio_plus: 30,
  enterprise: 150,
};

/** This tier's monthly roundtable run cap (0 when the tier can't run the feature). */
export function decisionRoundtableMonthlyCap(tier: Tier): number {
  return DECISION_ROUNDTABLE_MONTHLY_CAPS[tier];
}

/**
 * Pure: may this tier start another roundtable this month, given how many it has already run?
 * Returns a CapDecision so routes surface the reason verbatim (gating teaser vs cap-reached notice).
 */
export function evaluateCanRunRoundtable(tier: Tier, monthlyRunCount: number): CapDecision {
  if (!tierAllowsDecisionRoundtable(tier)) {
    return {
      ok: false,
      reason:
        "Decision Roundtable is a Studio+ feature. Upgrade to have three of your agents argue a call and bring you a verdict.",
    };
  }
  const cap = DECISION_ROUNDTABLE_MONTHLY_CAPS[tier];
  if (monthlyRunCount >= cap) {
    return {
      ok: false,
      reason: `You've run all ${cap} Decision Roundtables on your plan this month. They reset next month — or upgrade to Enterprise for more.`,
    };
  }
  return { ok: true, reason: "" };
}

// ── Ritual Scheduler active-ritual caps (PA-RITUAL-8, SPEC §9) ────────────────────────
//
// The sweep cron does per-owner polling work every 5 minutes, so the number of ACTIVE (enabled)
// rituals an owner can hold is bounded by tier. Paused rituals don't count — pause or delete an old
// one to author a new one at cap. The ladder mirrors the SMB price ladder: Starter 1, Pro 5, Pro+ 10,
// Studio 25, Studio+/Enterprise 100.
export const RITUAL_ACTIVE_CAPS: Record<Tier, number> = {
  starter: 1,
  pro: 5,
  pro_plus: 10,
  studio: 25,
  studio_plus: 100,
  enterprise: 100,
};

/** This tier's cap on active (enabled) rituals (PA-RITUAL-8). */
export function ritualActiveCap(tier: Tier): number {
  return RITUAL_ACTIVE_CAPS[tier];
}

/**
 * Pure: may this tier enable another ritual, given how many it already has active? Returns a
 * CapDecision so the route and the App surface show the same reason verbatim. Used on create and on
 * resume (resuming a paused ritual makes it active again, so it re-checks the cap).
 */
export function evaluateCanActivateRitual(tier: Tier, activeCount: number): CapDecision {
  const cap = RITUAL_ACTIVE_CAPS[tier];
  if (activeCount >= cap) {
    return {
      ok: false,
      reason:
        cap === 1
          ? "Your plan runs 1 ritual at a time. Pause or delete it to author a new one, or upgrade to run more."
          : `You're running all ${cap} rituals on your plan. Pause or delete one to author another, or upgrade to run more.`,
    };
  }
  return { ok: true, reason: "" };
}

// ── Website Monitoring active-URL caps (Skool Wave-2: Website Monitoring Agent) ──────────
//
// The */5 cron polls every active URL, so the number of ACTIVE (watching) URLs an owner can hold is
// bounded by tier. Paused URLs don't count. The task's four named breakpoints — Personal Brain 1 /
// Business Agent 5 / AI Agent Workspace 20 / Studio+ unlimited — map monotonically across the six
// internal rungs (the in-between Pro+/Studio rungs get the 20 of the mid tier; a higher price never
// grants less). Infinity = unlimited.
export const WEBSITE_MONITOR_CAPS: Record<Tier, number> = {
  starter: 1,
  pro: 5,
  pro_plus: 20,
  studio: 20,
  studio_plus: Infinity,
  enterprise: Infinity,
}

/** This tier's cap on active watched URLs (Infinity = unlimited). */
export function websiteMonitorCap(tier: Tier): number {
  return WEBSITE_MONITOR_CAPS[tier]
}

/** Pure: may this tier add another watched URL, given how many it already has active? */
export function evaluateCanAddMonitoredWebsite(tier: Tier, activeCount: number): CapDecision {
  const cap = WEBSITE_MONITOR_CAPS[tier]
  if (activeCount >= cap) {
    return {
      ok: false,
      reason:
        cap === 1
          ? "Your plan watches 1 website at a time. Pause or delete it to watch another, or upgrade to watch more."
          : `You're watching all ${cap} websites on your plan. Pause or delete one, or upgrade to watch more.`,
    }
  }
  return { ok: true, reason: "" }
}

// ── Proposal Generator gating (Skool Wave-2: Proposal & Document Agent) ───────────────────
//
// The Proposal Generator drafts a structured proposal (markdown + a Puppeteer PDF) from a Persona +
// brief — it leans on the Persona layer, so it's a Business Agent ($97, `pro`) and up feature. The
// free Personal Brain tier sees the App card with an upgrade CTA instead of the form.
export function tierAllowsProposalGenerator(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("pro")
}

// ── Browser Agent gating (PA-POS-19) ──────────────────────────────────────────────────────
//
// The Browser Agent runs a hosted browser session (Browserbase) for up to an hour per job plus
// a Computer Use planning call per step — the most expensive App on the shelf. Studio+
// ($497 AI Agent Workspace) and Enterprise only; lower tiers see the card with an upgrade chip.
export function tierAllowsBrowserAgent(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("studio_plus")
}

// ── Custom Agent Builder gating (PA-POS-34, amending PA-POS-27) ─────────────────────────────
//
// Every tier gets the compose action. Composing is one cheap Haiku parse call — the tier gate
// lives on the COMPOSED SPEC, not on composing: when the described agent needs a Studio+ App
// (Browser Agent, Idea Engine, …), the review card surfaces that and offers a Project Pass
// (PA-POS-31) on that specific App. The owner can approve a scoped version without those Apps.
export function tierAllowsAgentBuilder(tier: Tier): boolean {
  return tierRank(tier) >= tierRank("starter")
}

export type BrowserAgentJobLimits = {
  maxSteps: number
  maxWallSeconds: number
  maxCostCents: number
}

/** Per-job ceilings for the New Job sliders — the form clamps to these and the create route
 *  enforces them server-side. */
export function browserAgentJobLimits(tier: Tier): BrowserAgentJobLimits {
  if (tier === "enterprise") {
    return { maxSteps: 150, maxWallSeconds: 3600, maxCostCents: 2000 }
  }
  return { maxSteps: 75, maxWallSeconds: 3600, maxCostCents: 1000 }
}

// ── Stripe price ID resolution — env-first, hardcoded fallback (launch prep 2026-07-02) ──
//
// The live Stripe price IDs moved out of code and into Sensitive Vercel env vars so a Stripe
// key/price rotation is a config change, not a code deploy. The hardcoded IDs below stay ONLY
// as local-dev / test fallbacks so a checkout with no env set still resolves. In production the
// env vars are set to these same values, so this is a zero-breakage transition.
//
// Why the warn matters: if a production price rotates in Stripe and the env var isn't updated,
// getTierFromStripePriceId falls through to 'starter' (see below) — a silent downgrade that
// bills a Studio+ customer at Starter caps. The console.warn (repo convention, mirrors
// pocket-agent-webhook-tier.ts) surfaces the fallback in Sentry so we catch it before a customer does.
const PRICE_ENV_FALLBACKS = {
  STRIPE_PRICE_PA_STARTER: "price_1TdyfmJ6S5nx9HK5EeAZQEPj", // Starter $37/mo
  STRIPE_PRICE_PA_PRO: "price_1TfRbIJ6S5nx9HK5sucoD8sB", // Pro $97/mo
  STRIPE_PRICE_PA_PRO_PLUS: "price_1TfRbJJ6S5nx9HK5ldFrZv5o", // Pro+ $149/mo
  STRIPE_PRICE_PA_STUDIO: "price_1TfRbKJ6S5nx9HK5g3U1yYOK", // Studio $297/mo
  STRIPE_PRICE_PA_STUDIO_PLUS: "price_1TfRbLJ6S5nx9HK54VQ2nc0m", // Studio+ $497/mo
  STRIPE_PRICE_PA_SYNC: "price_1TfRmxJ6S5nx9HK5SoqFHdOY", // PA Sync $96/yr add-on
  STRIPE_PRICE_PA_PUBLISH: "price_1TfRmyJ6S5nx9HK5R9uxFpgd", // PA Publish $200/yr add-on
} as const;

type PriceEnvVar = keyof typeof PRICE_ENV_FALLBACKS;

const warnedPriceEnvs = new Set<string>();

/**
 * Read a Stripe price ID from its env var, or fall back to the hardcoded value. A missing env in
 * a non-test runtime is warned once per var so a production fallback shows up in Sentry. Pure enough
 * for tests — under Vitest (VITEST/NODE_ENV=test) the warn is suppressed, and with no env set the
 * fallback keeps the existing literal IDs the tests assert against.
 */
function resolvePriceId(envVar: PriceEnvVar): string {
  const fromEnv = process.env[envVar];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  if (!isTest && !warnedPriceEnvs.has(envVar)) {
    warnedPriceEnvs.add(envVar);
    console.warn(
      `[tier-caps] ${envVar} is not set; using the hardcoded Stripe price fallback. Set it in Vercel to avoid a silent tier mis-map.`,
    );
  }
  return PRICE_ENV_FALLBACKS[envVar];
}

// Source of truth for the SMB subscription tier a paid Stripe price grants. The Stripe webhook
// (src/app/api/stripe/webhook/route.ts) extracts the active price ID from a customer.subscription.*
// event and runs it through getTierFromStripePriceId to decide what tier to write to the customer's
// pocket_agent_subscriptions row.
//
// Kept as an exported, typed Record so the mapping is grep-able and unit-tested. Enterprise has no
// Stripe price (it's a "talk to sales" mailto), so it never appears here. The dev GTM add-ons
// (PA Sync / PA Publish, SPEC v4 Wave 3) are orthogonal yearly products — they are NOT SMB tiers, so
// they live in ADDON_PRICE_IDS below, not here.
export const PRICE_TO_TIER: Record<string, Tier> = {
  [resolvePriceId("STRIPE_PRICE_PA_STARTER")]: "starter",
  [resolvePriceId("STRIPE_PRICE_PA_PRO")]: "pro",
  [resolvePriceId("STRIPE_PRICE_PA_PRO_PLUS")]: "pro_plus",
  [resolvePriceId("STRIPE_PRICE_PA_STUDIO")]: "studio",
  [resolvePriceId("STRIPE_PRICE_PA_STUDIO_PLUS")]: "studio_plus",
};

/** Map a Stripe price ID to its SMB tier. Unknown prices default to 'starter'. */
export function getTierFromStripePriceId(priceId: string): Tier {
  return PRICE_TO_TIER[priceId] ?? "starter";
}

// ── Checkout-side tier → price mapping (PA-ORCH-10 provisioning fix) ──────────────────
//
// Every SMB tier except Enterprise has a Stripe price. Enterprise is a "talk to sales"
// mailto with no price, so it can never be checked out — hence PaidTier excludes it.
export type PaidTier = Exclude<Tier, "enterprise">;

// Reverse of PRICE_TO_TIER so the /start checkout route can resolve a price from the
// ?tier= param. Derived from the same source of truth so the two stay in lock-step — a
// price added to PRICE_TO_TIER is automatically routable here (asserted in tests).
export const TIER_TO_PRICE: Record<PaidTier, string> = Object.fromEntries(
  Object.entries(PRICE_TO_TIER).map(([priceId, tier]) => [tier, priceId]),
) as Record<PaidTier, string>;

// Monthly USD price per paid tier — data, used to show the right number on the /start
// trial form when a buyer arrives via /start?tier=pro etc. (Marketing copy lives on the
// /pricing page; this is just the figure so the form doesn't always say "$37/mo".)
export const TIER_PRICE_USD_MONTHLY: Record<PaidTier, number> = {
  starter: 37,
  pro: 97,
  pro_plus: 149,
  studio: 297,
  studio_plus: 497,
};

/**
 * Validate a raw `?tier=` checkout param against the known SMB ladder. Anything
 * missing, unknown, or `enterprise` (no Stripe price) falls back to `starter` so the
 * trial flow can never wedge on a bad param. Pure for testability.
 */
export function resolveCheckoutTier(raw: string | null | undefined): PaidTier {
  if (typeof raw === "string" && isTier(raw) && raw !== "enterprise") return raw;
  return "starter";
}

/**
 * Decide which SMB tier to provision for a subscription. The active price ID is the
 * source of truth (covers payment-link subscriptions too); `metadata.tier` — stamped by
 * the /start?tier= checkout flow — is a validated fallback for the rare case a price ID
 * isn't in the map yet. Returns null when the subscription carries no SMB tier at all
 * (e.g. an add-on-only subscription), which the webhook treats as "not a tier write".
 */
export function resolveProvisionTier(args: {
  priceIds: readonly string[];
  metadataTier?: string | null;
}): Tier | null {
  const fromPrice = highestTierFromPriceIds(args.priceIds);
  if (fromPrice) return fromPrice;
  const m = args.metadataTier;
  if (typeof m === "string" && isTier(m) && m !== "enterprise") return m;
  return null;
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
  sync: resolvePriceId("STRIPE_PRICE_PA_SYNC"),
  publish: resolvePriceId("STRIPE_PRICE_PA_PUBLISH"),
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
