// snapshot.ts — assembles the customer-facing Usage snapshot (PA-USAGE-4) and the per-feature soft-
// pause gate the dispatcher consults (PA-USAGE-6). The snapshot is one parallel fan-out across the
// per-feature counters; the gate is a single-metric read so the dispatcher pays for only what it needs.

import {
  USAGE_METRICS,
  metricConfig,
  usageCap,
  usagePct,
  evaluateTierLimitGate,
  nextTierUp,
  type Cap,
  type Tier,
  type TierLimitGate,
  type UsageMetricKey,
  type UsageUnit,
} from "./caps";
import {
  getCurrentTier,
  getPeriodDecision,
  leadScoutLeadsThisMonth,
  podcastWhisperMinutesThisMonth,
  youtubeIngestsThisMonth,
  subAgentRunsThisMonth,
  agentMinutesThisMonth,
  activeConnectionsCount,
  personasCount,
  roundtablesThisMonth,
  hasByoProvider,
  byoCostThisMonth,
  periodResetMs,
  type ByoCost,
} from "./db";
import { TIER_LABELS } from "@/lib/personas/tier-caps";

export type UsageMetricRow = {
  key: UsageMetricKey;
  label: string;
  unit: UsageUnit;
  /** Used amount in the row's declared unit (podcast is converted minutes → hours). */
  used: number;
  /** Tier cap in the row's declared unit, null = unlimited / informational. */
  cap: Cap;
  pct: number;
  informational: boolean;
  note?: string;
  blurb: string;
  /** Secondary line, e.g. the raw run count behind the agent-runtime minutes. */
  subNote?: string;
};

export type UsageSnapshot = {
  tier: Tier;
  tierLabel: string;
  nextTier: Tier | null;
  nextTierLabel: string | null;
  /** ISO start of NEXT month — when the monthly counters reset. */
  periodResetAt: string;
  metrics: UsageMetricRow[];
  byo: { configured: boolean; cost: ByoCost | null };
};

const MIN_PER_HOUR = 60;

/** The raw current-period usage for one metric, in the metric's COUNTER unit (podcast = minutes). */
async function rawUsedForMetric(key: UsageMetricKey, ownerId: string, nowMs: number): Promise<number> {
  switch (key) {
    case "lead_scout":
      return leadScoutLeadsThisMonth(ownerId, nowMs);
    case "podcast_whisper":
      return podcastWhisperMinutesThisMonth(ownerId, nowMs);
    case "youtube":
      return youtubeIngestsThisMonth(ownerId, nowMs);
    case "sub_agent":
      return agentMinutesThisMonth(ownerId);
    case "connections":
      return activeConnectionsCount(ownerId);
    case "personas":
      return personasCount(ownerId);
    case "roundtable":
      return roundtablesThisMonth(ownerId);
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

/** One decimal place, trailing-zero-trimmed (so 1.40 → 1.4, 2.00 → 2). */
function oneDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

async function buildMetricRow(key: UsageMetricKey, tier: Tier, ownerId: string, nowMs: number): Promise<UsageMetricRow> {
  const cfg = metricConfig(key);
  const rawUsed = await rawUsedForMetric(key, ownerId, nowMs);
  const rawCap = usageCap(key, tier); // null when informational/unlimited
  const informational = !cfg.caps;
  const pct = usagePct(rawUsed, rawCap);

  // Podcast counts minutes but reads in hours.
  if (key === "podcast_whisper") {
    return {
      key,
      label: cfg.label,
      unit: cfg.unit,
      used: oneDecimal(rawUsed / MIN_PER_HOUR),
      cap: rawCap === null ? null : oneDecimal(rawCap / MIN_PER_HOUR),
      pct,
      informational,
      note: cfg.note,
      blurb: cfg.blurb,
    };
  }

  const row: UsageMetricRow = {
    key,
    label: cfg.label,
    unit: cfg.unit,
    used: rawUsed,
    cap: rawCap,
    pct,
    informational,
    note: cfg.note,
    blurb: cfg.blurb,
  };

  // Agent runtime is metered in minutes; show the raw run count as a secondary line.
  if (key === "sub_agent") {
    const runs = await subAgentRunsThisMonth(ownerId, nowMs);
    row.subNote = `${runs} agent ${runs === 1 ? "run" : "runs"} this month`;
  }
  return row;
}

/** The full Usage tab snapshot for an owner. */
export async function getUsageSnapshot(ownerId: string, nowMs = Date.now()): Promise<UsageSnapshot> {
  const tier = await getCurrentTier(ownerId);
  const next = nextTierUp(tier);

  const metrics = await Promise.all(
    USAGE_METRICS.map((m) => buildMetricRow(m.key, tier, ownerId, nowMs)),
  );

  const byoConfigured = await hasByoProvider(ownerId);
  const cost = byoConfigured ? await byoCostThisMonth(ownerId, nowMs) : null;

  return {
    tier,
    tierLabel: TIER_LABELS[tier],
    nextTier: next,
    nextTierLabel: next ? TIER_LABELS[next] : null,
    periodResetAt: new Date(periodResetMs(nowMs)).toISOString(),
    metrics,
    byo: { configured: byoConfigured, cost },
  };
}

/**
 * The per-feature soft-pause gate (PA-USAGE-6). Reads the metric's current-period usage + the tier cap
 * + the owner's period ack and returns ok / warn_80 / block_100. The dispatcher calls this for the
 * 'sub_agent' feature (agent-runtime) BEFORE firing a background run; chat is exempt. A feature with no
 * cap on this tier (unlimited / informational) always returns ok.
 */
export async function checkTierLimitGate(
  ownerId: string,
  featureSlug: UsageMetricKey,
  nowMs = Date.now(),
): Promise<TierLimitGate> {
  const tier = await getCurrentTier(ownerId);
  const cap = usageCap(featureSlug, tier);
  if (cap === null || cap <= 0) {
    return { status: "ok", used: 0, cap, pct: 0 };
  }
  const [used, ack] = await Promise.all([
    rawUsedForMetric(featureSlug, ownerId, nowMs),
    getPeriodDecision(ownerId, nowMs),
  ]);
  return evaluateTierLimitGate(used, cap, ack);
}
