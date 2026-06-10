// caps.ts — the customer-facing USAGE model (Usage Surface v1, PA-USAGE-1..6). This is the tier-
// denominated replacement for the dollar-denominated Cost surface: in the default platform-managed
// flow the customer pays a flat subscription and Chase covers the API spend, so showing them dollars
// is misleading. They see how much of their PLAN they've used instead.
//
// One source of truth for the per-feature monthly caps. Where a cap already lives in code we reuse it
// (personas TIER_LIMITS, the Decision Roundtable monthly caps, the orchestrator agent-minute caps);
// where it only lived per-owner in the DB or not at all (Lead Scout monthly leads, Podcast Whisper
// hours) we state the locked tier numbers here. PURE: no I/O — the threshold/gate math is unit-tested
// in isolation (lib/usage/__tests__/caps.test.ts).

import { TIER_LIMITS, DECISION_ROUNDTABLE_MONTHLY_CAPS, type Tier } from "@/lib/personas/tier-caps";
import { AGENT_MINUTE_CAPS } from "@/lib/orchestrator/tier-caps";

export type { Tier };

// The metrics shown on the Usage tab. `informational` metrics have no cap — they show a count and a
// short note instead of a progress bar.
export type UsageMetricKey =
  | "lead_scout"
  | "podcast_whisper"
  | "youtube"
  | "sub_agent"
  | "connections"
  | "personas"
  | "roundtable";

// How a metric's number reads to a non-engineer owner.
export type UsageUnit = "leads" | "hours" | "videos" | "minutes" | "connections" | "personas" | "runs";

// null = unlimited (fair use). 0 = the feature isn't on this plan (upgrade to unlock).
export type Cap = number | null;

export type UsageMetricConfig = {
  key: UsageMetricKey;
  /** Customer-facing name. */
  label: string;
  unit: UsageUnit;
  /** Per-tier monthly cap, or null/undefined for informational metrics (no cap). */
  caps?: Record<Tier, Cap>;
  /** Shown under the metric when it has no cap (YouTube, Connections). */
  note?: string;
  /** A one-line plain-English read of what this counts. */
  blurb: string;
};

// ── Lead Scout — monthly leads (PA-USAGE-4) ─────────────────────────────────────────────────────────
// Locked numbers: Free 25 / Pro 250 / Pro+ 500 / Studio 2,500 / Studio+ 10,000 / Enterprise unlimited.
const LEAD_SCOUT_CAPS: Record<Tier, Cap> = {
  starter: 25,
  pro: 250,
  pro_plus: 500,
  studio: 2_500,
  studio_plus: 10_000,
  enterprise: null,
};

// ── Podcast Whisper — monthly listening hours, stored/counted in MINUTES (PA-USAGE-4) ────────────────
// Locked: Free 30 min / Pro 5h / Studio 50h / Studio+ 500h. Pro+ sits between Pro and Studio (10h);
// Enterprise is fair-use. The counter (pa_podcast_ingests.whisper_minutes) is in minutes, so the caps
// are in minutes; the Usage tab divides by 60 to show hours.
const PODCAST_WHISPER_MINUTE_CAPS: Record<Tier, Cap> = {
  starter: 30,
  pro: 300,
  pro_plus: 600,
  studio: 3_000,
  studio_plus: 30_000,
  enterprise: null,
};

// The ordered list the Usage tab renders. Caps reuse the existing source-of-truth records where one
// already exists, so the two surfaces can never drift on tier numbers.
export const USAGE_METRICS: readonly UsageMetricConfig[] = [
  {
    key: "lead_scout",
    label: "Lead Scout",
    unit: "leads",
    caps: LEAD_SCOUT_CAPS,
    blurb: "Businesses your agent scouted and scored this month.",
  },
  {
    key: "podcast_whisper",
    label: "Podcast transcription",
    unit: "hours",
    caps: PODCAST_WHISPER_MINUTE_CAPS,
    blurb: "Hours of podcast audio your agent listened to and took notes on.",
  },
  {
    key: "sub_agent",
    label: "Agent runtime",
    unit: "minutes",
    caps: AGENT_MINUTE_CAPS,
    blurb: "Minutes your background agents have run tasks for you this month.",
  },
  {
    key: "roundtable",
    label: "Decision Roundtable",
    unit: "runs",
    caps: DECISION_ROUNDTABLE_MONTHLY_CAPS,
    blurb: "Times three of your agents debated a call and brought you a verdict.",
  },
  {
    key: "personas",
    label: "Personas",
    unit: "personas",
    caps: personaCaps(),
    blurb: "Team agents you've created. Personas don't reset — this is your live count.",
  },
  {
    key: "youtube",
    label: "YouTube ingests",
    unit: "videos",
    note: "No limit on your plan — your agent watches as many as you send it.",
    blurb: "Videos your agent watched and folded into your brain this month.",
  },
  {
    key: "connections",
    label: "Connections",
    unit: "connections",
    note: "No limit — connect as many tools as you use.",
    blurb: "Tools your agent is currently connected to, like Gmail or your calendar.",
  },
] as const;

/** TIER_LIMITS keeps personas as a nested field; lift it into the flat Cap shape this surface uses. */
function personaCaps(): Record<Tier, Cap> {
  return {
    starter: TIER_LIMITS.starter.personas,
    pro: TIER_LIMITS.pro.personas,
    pro_plus: TIER_LIMITS.pro_plus.personas,
    studio: TIER_LIMITS.studio.personas,
    studio_plus: TIER_LIMITS.studio_plus.personas,
    enterprise: TIER_LIMITS.enterprise.personas,
  };
}

export function metricConfig(key: UsageMetricKey): UsageMetricConfig {
  const found = USAGE_METRICS.find((m) => m.key === key);
  if (!found) throw new Error(`unknown usage metric: ${key}`);
  return found;
}

/** This tier's cap for a metric, or null when the metric is informational / unlimited. */
export function usageCap(key: UsageMetricKey, tier: Tier): Cap {
  const cfg = metricConfig(key);
  if (!cfg.caps) return null;
  return cfg.caps[tier];
}

// ── The soft-pause thresholds (PA-USAGE-6) — the same 80% warn / 100% gate the cost surface used,
// now read against a tier cap instead of a dollar budget. ─────────────────────────────────────────
export const USAGE_WARN_PCT = 80;
export const USAGE_GATE_PCT = 100;

/** Percent of the cap used. null/0 caps → 0% (an informational or feature-off metric never "fills"). */
export function usagePct(used: number, cap: Cap): number {
  if (cap === null || cap <= 0) return 0;
  return (used / cap) * 100;
}

export type TierLimitStatus = "ok" | "warn_80" | "block_100";

export type TierLimitGate = {
  status: TierLimitStatus;
  used: number;
  cap: Cap;
  pct: number;
};

/**
 * The soft-pause decision (PA-USAGE-6), pure so the thresholds are unit-tested without I/O:
 *   • cap is null (unlimited) or <= 0 (feature off — handled by the hard cap elsewhere) → ok
 *   • owner answered 'pause' this period                                               → block
 *   • pct >= 100                                                                        → block
 *   • 80 <= pct < 100, not acked                                                        → warn
 *   • 80 <= pct < 100, acked 'keep_going'                                               → ok
 *   • pct < 80                                                                          → ok
 */
export function evaluateTierLimitGate(
  used: number,
  cap: Cap,
  ack: "keep_going" | "pause" | null,
): TierLimitGate {
  const pct = usagePct(used, cap);
  const base = { used, cap, pct };
  if (cap === null || cap <= 0) return { status: "ok", ...base };
  if (ack === "pause") return { status: "block_100", ...base };
  if (pct >= USAGE_GATE_PCT) return { status: "block_100", ...base };
  if (pct >= USAGE_WARN_PCT) {
    return ack === "keep_going" ? { status: "ok", ...base } : { status: "warn_80", ...base };
  }
  return { status: "ok", ...base };
}

/** The next tier up the ladder for an "Upgrade to X" CTA, or null at the top. */
const UPGRADE_LADDER: Record<Tier, Tier | null> = {
  starter: "pro",
  pro: "pro_plus",
  pro_plus: "studio",
  studio: "studio_plus",
  studio_plus: "enterprise",
  enterprise: null,
};

export function nextTierUp(tier: Tier): Tier | null {
  return UPGRADE_LADDER[tier];
}
