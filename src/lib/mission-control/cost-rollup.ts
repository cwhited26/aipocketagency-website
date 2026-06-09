// cost-rollup.ts — the Cost tab's read-side aggregation (Cost Observability SPEC §5.5, Phase 2).
//
// One pure folder (`rollupCostEvents`) turns a window of raw pa_cost_events rows into everything the
// Cost tab draws: the three tiles, the spend-over-time line buckets, and the three breakdowns (by
// feature area / by model / by backend). `getCostRollup` is the thin shell the route calls — it loads
// the owner's events over the period window via service-role REST, hands them to the folder, and caches
// the result in-memory per owner+period for 8 seconds so opening the tab doesn't fire four simultaneous
// SUM passes (it matches Mission Control's 8s auto-refresh cadence). No precomputation, no rollup table:
// at PA's row counts (<50k/year/owner) a live fold over the window is well under where that matters.
//
// Storage stays in MICRO-CENTS end to end (1 USD = 1,000,000 micro-cents — PA-COST-9); the lib sums
// pure integers and the surface rounds to dollars only at display, so sub-cent spend stays lossless.

export type CostPeriod = "day" | "week" | "month";

export function isCostPeriod(value: string): value is CostPeriod {
  return value === "day" || value === "week" || value === "month";
}

/** The pa_cost_events columns the read folds. Mirrors the ledger; the loader selects exactly these. */
export type CostEventRow = {
  feature_slug: string;
  backend: string;
  model: string | null;
  cost_micro_cents: number;
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type CostTiles = {
  /** SUM(cost_micro_cents) over the window — the surface divides to dollars at display. */
  totalSpendMicroCents: number;
  /** SUM(tokens_input + tokens_output). */
  totalTokens: number;
  /** Distinct chat turns + distinct sub-agent runs (conversational shape, approximate by design). */
  turnsRecorded: number;
};

/** One point on the spend-over-time line. Buckets are contiguous from period start to now. */
export type LineBucket = {
  /** ISO start of the bucket. */
  start: string;
  /** Short x-axis tick label (hour for Day, date for Week/Month). */
  label: string;
  spendMicroCents: number;
};

/** One row of a breakdown (a feature area, a model, or a backend). */
export type BreakdownRow = {
  key: string;
  label: string;
  spendMicroCents: number;
  events: number;
};

export type CostRollup = {
  period: CostPeriod;
  /** ISO start of the window the tiles + line + breakdowns cover. */
  periodStart: string;
  generatedAt: string;
  /** True when the owner has no metered events yet — the surface shows zero tiles + the explainer. */
  empty: boolean;
  tiles: CostTiles;
  line: LineBucket[];
  byFeature: BreakdownRow[];
  byModel: BreakdownRow[];
  byBackend: BreakdownRow[];
};

// ── Display labels ──────────────────────────────────────────────────────────────────────────

// Feature areas lead the breakdown row (PA-COST-5) — owners think in apps, not API providers. The
// slugs are the ledger's feature_slug enum; an unknown slug falls back to a title-cased version so a
// new feature area shows up readably the day it starts writing, before this map is updated.
const FEATURE_LABELS: Record<string, string> = {
  podcast: "Podcast",
  youtube: "YouTube",
  lead_scout: "Lead Scout",
  roundtable: "Roundtable",
  chat: "Chat",
  email_drafter: "Email Drafter",
  build_tools: "Build Tools",
  rag: "RAG",
};

const BACKEND_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  bright_data: "Bright Data",
  modal: "Modal",
  twilio: "Twilio",
  resend: "Resend",
};

function titleCase(slug: string): string {
  return slug
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function featureLabel(slug: string): string {
  return FEATURE_LABELS[slug] ?? titleCase(slug);
}

function backendLabel(slug: string): string {
  return BACKEND_LABELS[slug] ?? titleCase(slug);
}

// ── Window math (UTC day boundaries, so the fold is deterministic + testable) ─────────────────

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** UTC start-of-day for a given epoch ms. */
function startOfUtcDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/**
 * The window start for a period, anchored to UTC day boundaries:
 *   day   → midnight today (calendar day)
 *   week  → midnight 6 days ago (rolling 7-day window incl. today)
 *   month → midnight on the 1st of the current calendar month (month-to-date)
 * Month-to-date is the period an SMB owner mentally reconciles against (PA-COST-6).
 */
export function periodStartMs(period: CostPeriod, nowMs: number): number {
  const today = startOfUtcDay(nowMs);
  switch (period) {
    case "day":
      return today;
    case "week":
      return today - 6 * DAY_MS;
    case "month": {
      const d = new Date(nowMs);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    }
  }
}

// Bucket granularity per period: Day buckets hourly, Week/Month bucket daily. Buckets run from the
// window start up to now (no trailing future zeros), so the x-axis length scales with the period.
function bucketStepMs(period: CostPeriod): number {
  return period === "day" ? HOUR_MS : DAY_MS;
}

function bucketLabel(period: CostPeriod, startMs: number): string {
  const d = new Date(startMs);
  if (period === "day") {
    return `${String(d.getUTCHours()).padStart(2, "0")}:00`;
  }
  // Week/Month: "Jun 9"
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${month} ${d.getUTCDate()}`;
}

function buildBuckets(period: CostPeriod, startMs: number, nowMs: number): { start: number; end: number }[] {
  const step = bucketStepMs(period);
  const buckets: { start: number; end: number }[] = [];
  for (let t = startMs; t <= nowMs; t += step) {
    buckets.push({ start: t, end: t + step });
  }
  // Always at least one bucket (the current one), even at the very start of a period.
  if (buckets.length === 0) buckets.push({ start: startMs, end: startMs + step });
  return buckets;
}

// ── The pure fold ─────────────────────────────────────────────────────────────────────────────

function sortedBreakdown(
  rows: Map<string, { label: string; spend: number; events: number }>,
): BreakdownRow[] {
  return [...rows.entries()]
    .map(([key, v]) => ({ key, label: v.label, spendMicroCents: v.spend, events: v.events }))
    .sort((a, b) => b.spendMicroCents - a.spendMicroCents || a.label.localeCompare(b.label));
}

/**
 * Fold a window of ledger rows into the Cost tab snapshot. Pure (no I/O, no clock read — `nowMs` is
 * passed) so the bucketing + breakdown rules are unit-tested in isolation. `events` is assumed to be
 * already filtered to `>= periodStart`; out-of-window rows are dropped defensively rather than trusted.
 */
export function rollupCostEvents(
  events: CostEventRow[],
  opts: { period: CostPeriod; nowMs: number },
): CostRollup {
  const { period, nowMs } = opts;
  const startMs = periodStartMs(period, nowMs);
  const inWindow = events.filter((e) => {
    const t = Date.parse(e.created_at);
    return Number.isFinite(t) && t >= startMs && t <= nowMs;
  });

  // Tiles.
  let totalSpend = 0;
  let totalTokens = 0;
  const conversationIds = new Set<string>();
  const subAgentRunIds = new Set<string>();

  // Breakdowns.
  const byFeature = new Map<string, { label: string; spend: number; events: number }>();
  const byModel = new Map<string, { label: string; spend: number; events: number }>();
  const byBackend = new Map<string, { label: string; spend: number; events: number }>();

  // Line buckets, indexed for O(1) assignment.
  const buckets = buildBuckets(period, startMs, nowMs);
  const step = bucketStepMs(period);
  const bucketSpend = new Array<number>(buckets.length).fill(0);

  for (const e of inWindow) {
    const cost = Math.max(0, Math.round(e.cost_micro_cents) || 0);
    totalSpend += cost;
    totalTokens += (e.tokens_input ?? 0) + (e.tokens_output ?? 0);

    const meta = e.metadata ?? {};
    const conv = meta["conversation_id"];
    const run = meta["sub_agent_run_id"];
    if (typeof conv === "string" && conv) conversationIds.add(conv);
    if (typeof run === "string" && run) subAgentRunIds.add(run);

    bump(byFeature, e.feature_slug, featureLabel(e.feature_slug), cost);
    bump(byBackend, e.backend, backendLabel(e.backend), cost);
    // A null model is a flat-rate backend-only event (Bright Data / Modal) — grouped so the by-model
    // breakdown still totals to the same spend as the other two, never silently dropping those rows.
    const modelKey = e.model ?? "__flat__";
    const modelName = e.model ?? "Flat-rate calls";
    bump(byModel, modelKey, modelName, cost);

    const t = Date.parse(e.created_at);
    const idx = Math.min(buckets.length - 1, Math.floor((t - startMs) / step));
    if (idx >= 0) bucketSpend[idx] += cost;
  }

  const line: LineBucket[] = buckets.map((b, i) => ({
    start: new Date(b.start).toISOString(),
    label: bucketLabel(period, b.start),
    spendMicroCents: bucketSpend[i],
  }));

  return {
    period,
    periodStart: new Date(startMs).toISOString(),
    generatedAt: new Date(nowMs).toISOString(),
    empty: inWindow.length === 0,
    tiles: {
      totalSpendMicroCents: totalSpend,
      totalTokens,
      turnsRecorded: conversationIds.size + subAgentRunIds.size,
    },
    line,
    byFeature: sortedBreakdown(byFeature),
    byModel: sortedBreakdown(byModel),
    byBackend: sortedBreakdown(byBackend),
  };
}

function bump(
  m: Map<string, { label: string; spend: number; events: number }>,
  key: string,
  label: string,
  cost: number,
): void {
  const cur = m.get(key);
  if (cur) {
    cur.spend += cost;
    cur.events += 1;
  } else {
    m.set(key, { label, spend: cost, events: 1 });
  }
}

// ── The loaded shell (route entry point) ───────────────────────────────────────────────────────

export type LoadCostEvents = (args: { ownerId: string; sinceIso: string }) => Promise<CostEventRow[]>;

export type GetCostRollupArgs = {
  ownerId: string;
  period: CostPeriod;
  /** Injectable clock for tests; defaults to the real clock. */
  nowMs?: number;
  /** Injectable loader for tests; defaults to the service-role REST loader below. */
  loadEvents?: LoadCostEvents;
};

class CostRollupError extends Error {}

function serviceEnv(): { url: string; key: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new CostRollupError("Supabase service-role env not set");
  return { url: url.replace(/\/$/, ""), key };
}

// PostgREST hard caps a response; the window is well under this at PA's row counts, but the explicit
// limit means a runaway owner returns a (truncated) page instead of an unbounded read.
const MAX_ROWS = 50_000;

const defaultLoadEvents: LoadCostEvents = async ({ ownerId, sinceIso }) => {
  const env = serviceEnv();
  const params = new URLSearchParams({
    select: "feature_slug,backend,model,cost_micro_cents,tokens_input,tokens_output,created_at,metadata",
    owner_id: `eq.${ownerId}`,
    created_at: `gte.${sinceIso}`,
    order: "created_at.asc",
    limit: String(MAX_ROWS),
  });
  const res = await fetch(`${env.url}/rest/v1/pa_cost_events?${params.toString()}`, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new CostRollupError(`cost ledger read failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as CostEventRow[];
};

// Per owner+period cache, 8s TTL — matches Mission Control's auto-refresh cadence so the tab's four
// derived views (tiles + line + 3 breakdowns) come from one ledger read, not four. Module-level so it
// lives across requests in a warm function instance; cleared between tests via __clearCostRollupCache.
const CACHE_TTL_MS = 8_000;
const cache = new Map<string, { atMs: number; rollup: CostRollup }>();

/** Test-only: drop the in-memory cache so cached owner+period results don't bleed across cases. */
export function __clearCostRollupCache(): void {
  cache.clear();
}

/**
 * Load the owner's metered events over the period window and fold them into the Cost tab snapshot,
 * served from an 8s per-owner+period cache. Throws (→ route 500) on a ledger read failure rather than
 * silently returning an empty/partial rollup that would read as "you've spent nothing."
 */
export async function getCostRollup(args: GetCostRollupArgs): Promise<CostRollup> {
  const nowMs = args.nowMs ?? Date.now();
  const load = args.loadEvents ?? defaultLoadEvents;
  const cacheKey = `${args.ownerId}:${args.period}`;

  const hit = cache.get(cacheKey);
  if (hit && nowMs - hit.atMs < CACHE_TTL_MS) return hit.rollup;

  const sinceIso = new Date(periodStartMs(args.period, nowMs)).toISOString();
  const events = await load({ ownerId: args.ownerId, sinceIso });
  const rollup = rollupCostEvents(events, { period: args.period, nowMs });

  cache.set(cacheKey, { atMs: nowMs, rollup });
  return rollup;
}
