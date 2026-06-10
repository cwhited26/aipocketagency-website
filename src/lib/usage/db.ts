// db.ts — the service-role REST reads behind the Usage surface (Usage Surface v1, PA-USAGE-4). Each
// per-feature counter reads THIS owner's current-calendar-month usage straight from that feature's own
// table — the same live-read posture the Mission Control Operations tab uses (no cached rollup table).
// Direct REST, no SDK (repo rule). The period-decision ack reuses the dormant pa_cost_budget_decisions
// table as a generic per-(owner, period) "keep going" / "pause" store — the table survives the cost→
// usage reframe; only the dollar-budget table (pa_cost_budgets) goes dormant.
//
// Owner-id column varies by table (the codebase is one-business-per-user, so they all key the same
// auth user id): pa_lead_scout_runs / pa_podcast_ingests / pa_youtube_ingests use owner_id;
// pa_sub_agent_runs / personas use business_id; pa_connections uses user_id.

import { getCurrentTier, type Tier } from "@/lib/personas/tier-caps";
import { countPersonasForBusiness } from "@/lib/personas/db";
import { countRoundtablesThisMonth } from "@/lib/decisions/db";
import { fetchOrchestratorUsage } from "@/lib/orchestrator/db";
import { monthKey } from "@/lib/orchestrator/tier-caps";

export { getCurrentTier };
export type { Tier };

class UsageError extends Error {}

function serviceEnv(): { url: string; key: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new UsageError("Supabase service-role env not set");
  return { url: url.replace(/\/$/, ""), key };
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

// ── Period math (UTC calendar month) ────────────────────────────────────────────────────────────────

/** Epoch ms of the 1st of the current calendar month (UTC). */
export function periodStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Epoch ms of the 1st of NEXT calendar month (UTC) — when the monthly counters reset. */
export function periodResetMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/** The `date`-typed period key for pa_cost_budget_decisions (YYYY-MM-DD, UTC month start). */
export function periodStartDate(nowMs: number): string {
  return new Date(periodStartMs(nowMs)).toISOString().slice(0, 10);
}

// The cap bounds a runaway owner to a single (truncated) page when we sum a column in JS; at PA's row
// counts it's never reached. PostgREST aggregate functions are disabled by default, so we sum in JS —
// mirroring the Phase 2 cost-rollup loader.
const MAX_ROWS = 50_000;

/** Exact row count for an owner-scoped, month-bounded query (PostgREST count=exact via Content-Range). */
async function countRows(
  table: string,
  ownerColumn: string,
  ownerId: string,
  extra: Record<string, string> = {},
): Promise<number> {
  const env = serviceEnv();
  const params = new URLSearchParams({ select: "id", [ownerColumn]: `eq.${ownerId}`, ...extra });
  const res = await fetch(`${env.url}/rest/v1/${table}?${params.toString()}`, {
    headers: { ...authHeaders(env.key), Prefer: "count=exact", Range: "0-0" },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 206) {
    const body = await res.text().catch(() => "");
    throw new UsageError(`${table} count failed (${res.status}): ${body.slice(0, 160)}`);
  }
  // Content-Range looks like "0-0/123" (or "*/0" when empty).
  const range = res.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}

/** SUM of a numeric column over an owner's month-to-date rows (summed in JS — aggregates are off). */
async function sumColumnThisMonth(
  table: string,
  ownerColumn: string,
  sumColumn: string,
  ownerId: string,
  nowMs: number,
): Promise<number> {
  const env = serviceEnv();
  const sinceIso = new Date(periodStartMs(nowMs)).toISOString();
  const params = new URLSearchParams({
    select: sumColumn,
    [ownerColumn]: `eq.${ownerId}`,
    created_at: `gte.${sinceIso}`,
    limit: String(MAX_ROWS),
  });
  const res = await fetch(`${env.url}/rest/v1/${table}?${params.toString()}`, {
    headers: authHeaders(env.key),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UsageError(`${table} sum failed (${res.status}): ${body.slice(0, 160)}`);
  }
  const rows = (await res.json()) as Record<string, number | null>[];
  let total = 0;
  for (const r of rows) total += Math.max(0, r[sumColumn] ?? 0);
  return total;
}

// ── Per-feature counters ──────────────────────────────────────────────────────────────────────────

/** Leads scouted this month (SUM of pa_lead_scout_runs.lead_count). */
export function leadScoutLeadsThisMonth(ownerId: string, nowMs = Date.now()): Promise<number> {
  return sumColumnThisMonth("pa_lead_scout_runs", "owner_id", "lead_count", ownerId, nowMs);
}

/** Podcast minutes transcribed this month (SUM of pa_podcast_ingests.whisper_minutes). */
export function podcastWhisperMinutesThisMonth(ownerId: string, nowMs = Date.now()): Promise<number> {
  return sumColumnThisMonth("pa_podcast_ingests", "owner_id", "whisper_minutes", ownerId, nowMs);
}

/** YouTube videos ingested this month (row count of pa_youtube_ingests). */
export function youtubeIngestsThisMonth(ownerId: string, nowMs = Date.now()): Promise<number> {
  const sinceIso = new Date(periodStartMs(nowMs)).toISOString();
  return countRows("pa_youtube_ingests", "owner_id", ownerId, { created_at: `gte.${sinceIso}` });
}

/** Background agent runs started this month (row count of pa_sub_agent_runs). */
export function subAgentRunsThisMonth(ownerId: string, nowMs = Date.now()): Promise<number> {
  const sinceIso = new Date(periodStartMs(nowMs)).toISOString();
  return countRows("pa_sub_agent_runs", "business_id", ownerId, { created_at: `gte.${sinceIso}` });
}

/** Agent-minutes metered this month (the orchestrator's monthly cap is in agent-minutes). */
export async function agentMinutesThisMonth(ownerId: string): Promise<number> {
  const usage = await fetchOrchestratorUsage(ownerId, monthKey());
  return usage?.agent_minutes_used ?? 0;
}

/** Currently-active connections (informational — no cap). */
export function activeConnectionsCount(ownerId: string): Promise<number> {
  return countRows("pa_connections", "user_id", ownerId, { status: "eq.active" });
}

/** Live persona count (reuses the personas data layer; personas don't reset monthly). */
export function personasCount(ownerId: string): Promise<number> {
  return countPersonasForBusiness(ownerId);
}

/** Decision Roundtable runs this month (reuses the decisions data layer). */
export async function roundtablesThisMonth(ownerId: string): Promise<number> {
  const res = await countRoundtablesThisMonth(ownerId);
  return res.ok ? res.data : 0;
}

// ── Period decision ack (reused pa_cost_budget_decisions, now usage-framed) ──────────────────────────

const DECISIONS = "pa_cost_budget_decisions";

export type PeriodDecision = "keep_going" | "pause";

/** The owner's persisted soft-pause choice for the current period (or null). */
export async function getPeriodDecision(ownerId: string, nowMs = Date.now()): Promise<PeriodDecision | null> {
  const env = serviceEnv();
  const params = new URLSearchParams({
    select: "decision",
    owner_id: `eq.${ownerId}`,
    period_start: `eq.${periodStartDate(nowMs)}`,
    limit: "1",
  });
  const res = await fetch(`${env.url}/rest/v1/${DECISIONS}?${params.toString()}`, {
    headers: authHeaders(env.key),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UsageError(`decision read failed (${res.status}): ${body.slice(0, 160)}`);
  }
  const rows = (await res.json()) as { decision: PeriodDecision }[];
  return rows[0]?.decision ?? null;
}

/** Persist the owner's soft-pause choice for the current period (upsert on (owner, period_start)). */
export async function recordPeriodDecision(
  ownerId: string,
  decision: PeriodDecision,
  nowMs = Date.now(),
): Promise<void> {
  const env = serviceEnv();
  const res = await fetch(`${env.url}/rest/v1/${DECISIONS}?on_conflict=owner_id,period_start`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      owner_id: ownerId,
      period_start: periodStartDate(nowMs),
      decision,
      decided_at: new Date(nowMs).toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UsageError(`decision write failed (${res.status}): ${body.slice(0, 160)}`);
  }
}

// ── BYO LLM real-cost read (PA-USAGE-7) ──────────────────────────────────────────────────────────────
// Only owners who configured their OWN provider key see dollars — it's their money, their bill. The
// dollar data already lands in pa_cost_events (the data layer is unchanged); we just surface it here
// for BYO owners and never for platform-managed ones.

/** True iff the owner has a BYO provider configured (a non-pa_managed row in pa_llm_provider_settings). */
export async function hasByoProvider(ownerId: string): Promise<boolean> {
  const env = serviceEnv();
  const params = new URLSearchParams({
    select: "provider",
    user_id: `eq.${ownerId}`,
    provider: "neq.pa_managed",
    limit: "1",
  });
  const res = await fetch(`${env.url}/rest/v1/pa_llm_provider_settings?${params.toString()}`, {
    headers: authHeaders(env.key),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UsageError(`provider read failed (${res.status}): ${body.slice(0, 160)}`);
  }
  const rows = (await res.json()) as { provider: string }[];
  return rows.length > 0;
}

export type ByoCostBreakdownRow = { featureSlug: string; microCents: number };
export type ByoCost = { totalMicroCents: number; byFeature: ByoCostBreakdownRow[] };

/** Month-to-date real spend (micro-cents) from pa_cost_events, grouped by feature, for a BYO owner. */
export async function byoCostThisMonth(ownerId: string, nowMs = Date.now()): Promise<ByoCost> {
  const env = serviceEnv();
  const sinceIso = new Date(periodStartMs(nowMs)).toISOString();
  const params = new URLSearchParams({
    select: "feature_slug,cost_micro_cents",
    owner_id: `eq.${ownerId}`,
    created_at: `gte.${sinceIso}`,
    limit: String(MAX_ROWS),
  });
  const res = await fetch(`${env.url}/rest/v1/pa_cost_events?${params.toString()}`, {
    headers: authHeaders(env.key),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UsageError(`cost read failed (${res.status}): ${body.slice(0, 160)}`);
  }
  const rows = (await res.json()) as { feature_slug: string | null; cost_micro_cents: number | null }[];
  let total = 0;
  const byFeatureMap = new Map<string, number>();
  for (const r of rows) {
    const micro = Math.max(0, Math.round(r.cost_micro_cents ?? 0));
    total += micro;
    const slug = r.feature_slug ?? "other";
    byFeatureMap.set(slug, (byFeatureMap.get(slug) ?? 0) + micro);
  }
  const byFeature = [...byFeatureMap.entries()]
    .map(([featureSlug, microCents]) => ({ featureSlug, microCents }))
    .sort((a, b) => b.microCents - a.microCents);
  return { totalMicroCents: total, byFeature };
}
