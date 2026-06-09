// budget.ts — the per-owner monthly cost budget: read, edit (supersede chain), and the soft-pause gate
// (Cost Observability SPEC §5.3/§5.4, PA-COST-12..14). Phase 3 (Settings → Budget) and Phase 4 (the
// dispatcher gate) both read from here.
//
// The pa_cost_budgets TABLE + its tier-default seed shipped in migration 053 (Phase 1). This file is
// the write/supersede path on top of it plus the gate decision function. Direct service-role REST (no
// SDK — repo rule). All money is integer math: budgets store CENTS (pa_cost_budgets.budget_cents), the
// ledger stores MICRO-CENTS (1 cent = 10,000 micro-cents; 1 USD = 1,000,000 — PA-COST-9). The gate
// compares MTD spend (micro-cents) against the cap (cents → micro-cents) so sub-cent spend never rounds.
//
// PURE vs I/O: `evaluateGate` (the threshold/decision rule) and `tierDefaultBudgetCents` are pure and
// unit-tested in isolation; everything else is the thin REST shell around them.

import { getCurrentTier, type Tier } from "@/lib/personas/tier-caps";

// ── Tier-default monthly budgets (SPEC §5.3, PA-COST-3) ─────────────────────────────────────────────
// Mirrors the seed in migration 053: Free/Starter $0 · Pro $25 · Pro+ $50 (interpolated — the ladder
// has 6 tiers, the SPEC names 5; Pro+ sits between Pro and Studio) · Studio $100 · Studio+ $400 ·
// Enterprise $2000. The Settings "Reset to tier default" button reads this; the migration seed and this
// map are the same numbers so a reset returns the owner to exactly what they were provisioned with.
export const TIER_DEFAULT_BUDGET_CENTS: Record<Tier, number> = {
  starter: 0,
  pro: 2500,
  pro_plus: 5000,
  studio: 10000,
  studio_plus: 40000,
  enterprise: 200000,
};

export function tierDefaultBudgetCents(tier: Tier): number {
  return TIER_DEFAULT_BUDGET_CENTS[tier] ?? 0;
}

export const MICRO_CENTS_PER_CENT = 10_000;

// The 80% warn / 100% gate thresholds (SPEC §5.4, PA-COST-4).
export const WARN_THRESHOLD_PCT = 80;
export const GATE_THRESHOLD_PCT = 100;

export type BudgetDecision = "keep_going" | "pause";

export type ActiveBudget = {
  id: string;
  budgetCents: number;
  period: string;
  effectiveFrom: string;
};

export type BudgetGate =
  | { status: "ok"; spentMicroCents: number; budgetCents: number; pct: number }
  | { status: "warn_80"; spentMicroCents: number; budgetCents: number; pct: number }
  | { status: "block_100"; spentMicroCents: number; budgetCents: number; pct: number };

/** A full snapshot for the Settings → Budget surface. */
export type BudgetSummary = {
  budgetCents: number;
  spentMicroCents: number;
  pct: number;
  /** ISO start of the current period (1st of the month, UTC). */
  periodStart: string;
  /** ISO start of the NEXT period — the date the spend counter resets. */
  periodResetAt: string;
  /** The owner's persisted soft-pause choice this period, if any. */
  decision: BudgetDecision | null;
  /** The gate state derived from spend + cap + decision. */
  gate: BudgetGate;
  tier: Tier;
  tierDefaultCents: number;
};

// ── The pure gate rule (SPEC §5.4) ──────────────────────────────────────────────────────────────────

/** Percent of the cap spent. A $0 cap is treated as 0% when nothing's spent, else fully over (100%+). */
export function spentPct(spentMicroCents: number, budgetCents: number): number {
  const capMicro = budgetCents * MICRO_CENTS_PER_CENT;
  if (capMicro <= 0) return spentMicroCents > 0 ? 100 : 0;
  return (spentMicroCents / capMicro) * 100;
}

/**
 * The soft-pause decision (SPEC §5.4), pure so the thresholds are unit-tested without I/O:
 *   • owner chose 'pause' this period → block every new dispatch (regardless of pct)
 *   • pct >= 100                      → block (stage the Mission Control gate card)
 *   • 80 <= pct < 100, not acked      → warn (the dispatcher pauses + surfaces the choice)
 *   • 80 <= pct < 100, acked keep_going → ok (warn already answered for the period)
 *   • pct < 80                        → ok
 */
export function evaluateGate(
  spentMicroCents: number,
  budgetCents: number,
  decision: BudgetDecision | null,
): BudgetGate {
  const pct = spentPct(spentMicroCents, budgetCents);
  const base = { spentMicroCents, budgetCents, pct };
  if (decision === "pause") return { status: "block_100", ...base };
  if (pct >= GATE_THRESHOLD_PCT) return { status: "block_100", ...base };
  if (pct >= WARN_THRESHOLD_PCT) {
    return decision === "keep_going" ? { status: "ok", ...base } : { status: "warn_80", ...base };
  }
  return { status: "ok", ...base };
}

// ── Period math (UTC calendar month, matching the cost-rollup's month-to-date window) ───────────────

/** Epoch ms of the 1st of the current calendar month (UTC). */
export function periodStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** Epoch ms of the 1st of NEXT calendar month (UTC) — when the spend counter resets. */
export function periodResetMs(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/** The `date`-typed period key for pa_cost_budget_decisions (YYYY-MM-DD, UTC month start). */
export function periodStartDate(nowMs: number): string {
  return new Date(periodStartMs(nowMs)).toISOString().slice(0, 10);
}

// ── Service-role REST shell ─────────────────────────────────────────────────────────────────────────

class BudgetError extends Error {}

function serviceEnv(): { url: string; key: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new BudgetError("Supabase service-role env not set");
  return { url: url.replace(/\/$/, ""), key };
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

const BUDGETS = "pa_cost_budgets";
const DECISIONS = "pa_cost_budget_decisions";
const EVENTS = "pa_cost_events";

/** Read the owner's single active budget row (or null if none — e.g. seed not yet applied). */
export async function getActiveBudget(ownerId: string): Promise<ActiveBudget | null> {
  const env = serviceEnv();
  const params = new URLSearchParams({
    select: "id,budget_cents,period,effective_from",
    owner_id: `eq.${ownerId}`,
    status: "eq.active",
    limit: "1",
  });
  const res = await fetch(`${env.url}/rest/v1/${BUDGETS}?${params.toString()}`, {
    headers: authHeaders(env.key),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new BudgetError(`budget read failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const rows = (await res.json()) as {
    id: string;
    budget_cents: number;
    period: string;
    effective_from: string;
  }[];
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    budgetCents: row.budget_cents,
    period: row.period,
    effectiveFrom: row.effective_from,
  };
}

// PostgREST aggregate functions (`cost_micro_cents.sum()`) are DISABLED by default on Supabase, so we
// fetch the month's events and sum in JS — exactly what the Phase 2 cost-rollup loader does. The cap
// bounds a runaway owner to a single (truncated) page; at PA's row counts (<50k/year) it's never hit.
const MAX_SPEND_ROWS = 50_000;

/** SUM(cost_micro_cents) over the owner's current calendar-month-to-date events. */
export async function getMonthToDateSpendMicroCents(ownerId: string, nowMs = Date.now()): Promise<number> {
  const env = serviceEnv();
  const sinceIso = new Date(periodStartMs(nowMs)).toISOString();
  const params = new URLSearchParams({
    select: "cost_micro_cents",
    owner_id: `eq.${ownerId}`,
    created_at: `gte.${sinceIso}`,
    limit: String(MAX_SPEND_ROWS),
  });
  const res = await fetch(`${env.url}/rest/v1/${EVENTS}?${params.toString()}`, {
    headers: authHeaders(env.key),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new BudgetError(`spend read failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const rows = (await res.json()) as { cost_micro_cents: number | null }[];
  let total = 0;
  for (const r of rows) total += Math.max(0, Math.round(r.cost_micro_cents ?? 0));
  return total;
}

/** Read the owner's persisted soft-pause choice for the current period (or null). */
export async function getPeriodDecision(ownerId: string, nowMs = Date.now()): Promise<BudgetDecision | null> {
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
    throw new BudgetError(`decision read failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const rows = (await res.json()) as { decision: BudgetDecision }[];
  return rows[0]?.decision ?? null;
}

/**
 * Persist the owner's soft-pause choice for the current period (upsert on the (owner, period_start) PK).
 * 'keep_going' acks the 80% warn for the rest of the month; 'pause' gates new dispatches until next period.
 */
export async function recordPeriodDecision(
  ownerId: string,
  decision: BudgetDecision,
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
    throw new BudgetError(`decision write failed (${res.status}): ${body.slice(0, 200)}`);
  }
}

/**
 * Edit the owner's budget via the supersede chain (SPEC §5.3): retire the current active row first
 * (status='superseded' + effective_until), insert the new active row, then link the old row to it.
 * Retiring first is what keeps the partial unique index (one active per owner) satisfied. History is
 * preserved. Lowering below current spend is allowed — it immediately trips the 100% gate (SPEC §5.3).
 */
export async function setBudget(ownerId: string, budgetCents: number): Promise<ActiveBudget> {
  if (!Number.isFinite(budgetCents) || budgetCents < 0) {
    throw new BudgetError("budget must be a non-negative whole-cent amount");
  }
  const cents = Math.round(budgetCents);
  const env = serviceEnv();
  const nowIso = new Date().toISOString();
  // Pre-generate the replacement row's id so the retiring PATCH can set superseded_by in the SAME write
  // — the full chain link lands atomically, with no third best-effort patch (which would force a silent
  // catch). The new row is then inserted with this explicit id.
  const newId = crypto.randomUUID();

  // 1. Retire the prior active row (if any) so the new insert doesn't collide on the active index, and
  //    point its supersede link at the replacement in one write.
  const current = await getActiveBudget(ownerId);
  if (current) {
    const retire = await fetch(
      `${env.url}/rest/v1/${BUDGETS}?id=eq.${encodeURIComponent(current.id)}&status=eq.active`,
      {
        method: "PATCH",
        headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ status: "superseded", effective_until: nowIso, superseded_by: newId }),
        cache: "no-store",
      },
    );
    if (!retire.ok) {
      const body = await retire.text().catch(() => "");
      throw new BudgetError(`budget supersede failed (${retire.status}): ${body.slice(0, 200)}`);
    }
  }

  // 2. Insert the new active row under the pre-generated id.
  const insertRes = await fetch(`${env.url}/rest/v1/${BUDGETS}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      id: newId,
      owner_id: ownerId,
      period: current?.period ?? "monthly",
      budget_cents: cents,
      status: "active",
      effective_from: nowIso,
    }),
    cache: "no-store",
  });
  if (!insertRes.ok) {
    const body = await insertRes.text().catch(() => "");
    throw new BudgetError(`budget insert failed (${insertRes.status}): ${body.slice(0, 200)}`);
  }
  const row = ((await insertRes.json()) as {
    id: string;
    budget_cents: number;
    period: string;
    effective_from: string;
  }[])[0];
  if (!row) throw new BudgetError("budget insert returned no row");

  return {
    id: row.id,
    budgetCents: row.budget_cents,
    period: row.period,
    effectiveFrom: row.effective_from,
  };
}

/** Reset the owner's budget to the default for their current tier (SPEC §5.6 reset button). */
export async function resetBudgetToTierDefault(ownerId: string): Promise<ActiveBudget> {
  const tier = await getCurrentTier(ownerId);
  return setBudget(ownerId, tierDefaultBudgetCents(tier));
}

/**
 * The soft-pause gate (SPEC §5.4). Reads the owner's cap + month-to-date spend + period decision and
 * returns ok / warn_80 / block_100. The dispatcher calls this BEFORE firing a sub-agent (chat is exempt
 * — PA-COST-7). A missing budget row (no seed yet) is treated as an unlimited/ok pass rather than a hard
 * block, so an un-provisioned owner is never stranded.
 */
export async function checkBudgetGate(ownerId: string, nowMs = Date.now()): Promise<BudgetGate> {
  const budget = await getActiveBudget(ownerId);
  if (!budget) {
    return { status: "ok", spentMicroCents: 0, budgetCents: 0, pct: 0 };
  }
  const [spent, decision] = await Promise.all([
    getMonthToDateSpendMicroCents(ownerId, nowMs),
    getPeriodDecision(ownerId, nowMs),
  ]);
  return evaluateGate(spent, budget.budgetCents, decision);
}

/** Full snapshot for the Settings → Budget surface. */
export async function getBudgetSummary(ownerId: string, nowMs = Date.now()): Promise<BudgetSummary> {
  const [budget, spent, decision, tier] = await Promise.all([
    getActiveBudget(ownerId),
    getMonthToDateSpendMicroCents(ownerId, nowMs),
    getPeriodDecision(ownerId, nowMs),
    getCurrentTier(ownerId),
  ]);
  const budgetCents = budget?.budgetCents ?? tierDefaultBudgetCents(tier);
  return {
    budgetCents,
    spentMicroCents: spent,
    pct: spentPct(spent, budgetCents),
    periodStart: new Date(periodStartMs(nowMs)).toISOString(),
    periodResetAt: new Date(periodResetMs(nowMs)).toISOString(),
    decision,
    gate: evaluateGate(spent, budgetCents, decision),
    tier,
    tierDefaultCents: tierDefaultBudgetCents(tier),
  };
}
