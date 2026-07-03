// Metering I/O (PA-POS-30/31): direct service-role REST against pa_project_passes,
// pa_top_up_purchases, pa_credit_allowances, and pa_cost_events (migration 100). No SDK — repo
// rule (see lib/cost/log.ts). Reads return safe fallbacks on failure with a structured warn;
// the webhook writers return a Result so the caller can decide what a failure means.

import type { PassAppSlug } from "@/data/project-passes";
import { isPassAppSlug } from "@/data/project-passes";
import { METERED_FEATURE_SLUGS } from "./credits";
import type { ProjectPass } from "./passes";

type ServiceEnv = { url: string; key: string };

function serviceEnv(): ServiceEnv | null {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function headers(env: ServiceEnv): Record<string, string> {
  return {
    apikey: env.key,
    Authorization: `Bearer ${env.key}`,
    "Content-Type": "application/json",
  };
}

export type StoreResult = { ok: true } | { ok: false; status: number; error: string };

// ── Project Passes ──────────────────────────────────────────────────────────────────────────

type PassRow = {
  id: string;
  app_slug: string;
  granted_at: string;
  expires_at: string;
  remaining_run_budget: number | null;
  price_paid_cents_at_purchase: number;
  tier_at_purchase: string;
};

function toPass(row: PassRow): ProjectPass | null {
  if (!isPassAppSlug(row.app_slug)) return null;
  return {
    id: row.id,
    appSlug: row.app_slug,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    remainingRunBudget: row.remaining_run_budget,
    pricePaidCents: row.price_paid_cents_at_purchase,
    tierAtPurchase: row.tier_at_purchase,
  };
}

/** Every pass this owner has bought (newest first) — the entitlement resolver and the nudge
 *  both read from this one list. Empty array on any failure (fail closed on rental access;
 *  the tier path is unaffected). */
export async function listPassesForOwner(ownerId: string): Promise<ProjectPass[]> {
  const env = serviceEnv();
  if (!env) return [];
  const url =
    `${env.url}/rest/v1/pa_project_passes` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&select=id,app_slug,granted_at,expires_at,remaining_run_budget,price_paid_cents_at_purchase,tier_at_purchase` +
    `&order=granted_at.desc&limit=200`;
  try {
    const res = await fetch(url, { headers: headers(env), cache: "no-store" });
    if (!res.ok) {
      console.warn("[metering/store] pass list read failed", { status: res.status });
      return [];
    }
    const rows = (await res.json()) as PassRow[];
    return rows.map(toPass).filter((p): p is ProjectPass => p !== null);
  } catch (e) {
    console.warn("[metering/store] pass list read failed (network)", {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

/** Webhook writer — idempotent by stripe_session_id (merge-duplicates across Stripe retries). */
export async function insertProjectPass(args: {
  ownerId: string;
  appSlug: PassAppSlug;
  expiresAt: string;
  remainingRunBudget: number | null;
  pricePaidCents: number;
  tierAtPurchase: string;
  stripeSessionId: string;
}): Promise<StoreResult> {
  const env = serviceEnv();
  if (!env) return { ok: false, status: 500, error: "service-role env not set" };
  const res = await fetch(
    `${env.url}/rest/v1/pa_project_passes?on_conflict=stripe_session_id`,
    {
      method: "POST",
      headers: { ...headers(env), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        owner_id: args.ownerId,
        app_slug: args.appSlug,
        expires_at: args.expiresAt,
        remaining_run_budget: args.remainingRunBudget,
        price_paid_cents_at_purchase: args.pricePaidCents,
        tier_at_purchase: args.tierAtPurchase,
        stripe_session_id: args.stripeSessionId,
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true };
}

/**
 * Burn one run off a run-budget pass (Idea Engine MVP ship, Roundtable debate). Guarded server-side
 * with gt.0 so two concurrent runs can't drive the budget negative. Best-effort: a failed decrement
 * is logged, never thrown — the approved run it meters must not break (same posture as cost/log).
 */
export async function decrementPassRunBudget(passId: string): Promise<void> {
  const env = serviceEnv();
  if (!env) return;
  // PostgREST can't do column arithmetic in PATCH; read-then-write with the gt.0 guard on the
  // write keeps it safe (the guard, not the read, is the race protection).
  try {
    const readRes = await fetch(
      `${env.url}/rest/v1/pa_project_passes?id=eq.${encodeURIComponent(passId)}&select=remaining_run_budget`,
      { headers: headers(env), cache: "no-store" },
    );
    if (!readRes.ok) {
      console.warn("[metering/store] pass budget read failed", { passId, status: readRes.status });
      return;
    }
    const rows = (await readRes.json()) as { remaining_run_budget: number | null }[];
    const budget = rows[0]?.remaining_run_budget;
    if (budget === null || budget === undefined || budget <= 0) return;
    const patchRes = await fetch(
      `${env.url}/rest/v1/pa_project_passes?id=eq.${encodeURIComponent(passId)}&remaining_run_budget=gt.0`,
      {
        method: "PATCH",
        headers: { ...headers(env), Prefer: "return=minimal" },
        body: JSON.stringify({ remaining_run_budget: budget - 1 }),
        cache: "no-store",
      },
    );
    if (!patchRes.ok) {
      console.warn("[metering/store] pass budget decrement failed", {
        passId,
        status: patchRes.status,
      });
    }
  } catch (e) {
    console.warn("[metering/store] pass budget decrement failed (network)", {
      passId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

// ── Top Ups ─────────────────────────────────────────────────────────────────────────────────

export async function insertTopUpPurchase(args: {
  ownerId: string;
  stripeSessionId: string;
  creditsAdded: number;
  amountPaidCents: number;
  /** 'onboarding_bonus' rows (PA-POS-36) are $0 grants keyed by a synthetic session id —
   *  same UNIQUE idempotency, same cycle math, segmented in the ledger by this column. */
  source?: "top_up" | "onboarding_bonus";
}): Promise<StoreResult> {
  const env = serviceEnv();
  if (!env) return { ok: false, status: 500, error: "service-role env not set" };
  const res = await fetch(
    `${env.url}/rest/v1/pa_top_up_purchases?on_conflict=stripe_session_id`,
    {
      method: "POST",
      headers: { ...headers(env), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        owner_id: args.ownerId,
        stripe_session_id: args.stripeSessionId,
        credits_added: args.creditsAdded,
        amount_paid_cents: args.amountPaidCents,
        // Only sent when set: pre-105 rows/writes keep working, the column default covers Stripe.
        ...(args.source ? { source: args.source } : {}),
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true };
}

/** Sum of Top Up credits this owner bought in [since, until). 0 on failure (understates the
 *  balance rather than inventing credits). */
export async function sumTopUpCredits(ownerId: string, since: string, until: string): Promise<number> {
  const env = serviceEnv();
  if (!env) return 0;
  const url =
    `${env.url}/rest/v1/pa_top_up_purchases` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&purchased_at=gte.${encodeURIComponent(since)}&purchased_at=lt.${encodeURIComponent(until)}` +
    `&select=credits_added&limit=500`;
  try {
    const res = await fetch(url, { headers: headers(env), cache: "no-store" });
    if (!res.ok) return 0;
    const rows = (await res.json()) as { credits_added: number }[];
    return rows.reduce((sum, r) => sum + (r.credits_added ?? 0), 0);
  } catch {
    return 0;
  }
}

// ── Allowance rows ──────────────────────────────────────────────────────────────────────────

export type AllowanceRow = {
  id: string;
  owner_id: string;
  tier_slug: string;
  cycle_start: string;
  cycle_end: string;
  allowance_credits: number;
  consumed_credits: number;
};

export async function fetchLatestAllowance(ownerId: string): Promise<AllowanceRow | null> {
  const env = serviceEnv();
  if (!env) return null;
  const url =
    `${env.url}/rest/v1/pa_credit_allowances` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}&order=cycle_end.desc&limit=1`;
  try {
    const res = await fetch(url, { headers: headers(env), cache: "no-store" });
    if (!res.ok) return null;
    const rows = (await res.json()) as AllowanceRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function insertAllowance(args: {
  ownerId: string;
  tierSlug: "studio_plus" | "enterprise";
  cycleStart: string;
  cycleEnd: string;
  allowanceCredits: number;
}): Promise<AllowanceRow | null> {
  const env = serviceEnv();
  if (!env) return null;
  const res = await fetch(
    `${env.url}/rest/v1/pa_credit_allowances?on_conflict=owner_id,cycle_start`,
    {
      method: "POST",
      headers: { ...headers(env), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        owner_id: args.ownerId,
        tier_slug: args.tierSlug,
        cycle_start: args.cycleStart,
        cycle_end: args.cycleEnd,
        allowance_credits: args.allowanceCredits,
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.warn("[metering/store] allowance insert failed", { status: res.status });
    return null;
  }
  const rows = (await res.json()) as AllowanceRow[];
  return rows[0] ?? null;
}

/** Refresh the cached consumed_credits rollup on an allowance row. Best-effort. */
export async function updateAllowanceConsumed(id: string, consumedCredits: number): Promise<void> {
  const env = serviceEnv();
  if (!env) return;
  try {
    await fetch(`${env.url}/rest/v1/pa_credit_allowances?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { ...headers(env), Prefer: "return=minimal" },
      body: JSON.stringify({ consumed_credits: consumedCredits, updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
  } catch {
    // rollup cache only — the ledger sum is the source of truth
  }
}

/** All allowance rows whose cycle has lapsed — the reset cron's work list. */
export async function listLapsedAllowances(nowIso: string): Promise<AllowanceRow[]> {
  const env = serviceEnv();
  if (!env) return [];
  const url =
    `${env.url}/rest/v1/pa_credit_allowances` +
    `?cycle_end=lt.${encodeURIComponent(nowIso)}&order=cycle_end.asc&limit=500`;
  try {
    const res = await fetch(url, { headers: headers(env), cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as AllowanceRow[];
  } catch {
    return [];
  }
}

// ── Cost-event sums (the ledger is the source of truth for consumption) ────────────────────

/** Sum of metered-App spend (micro-cents) for this owner since `since`. 0 on failure. */
export async function sumMeteredCostMicroCents(ownerId: string, since: string): Promise<number> {
  const env = serviceEnv();
  if (!env) return 0;
  const slugs = METERED_FEATURE_SLUGS.join(",");
  const url =
    `${env.url}/rest/v1/pa_cost_events` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&feature_slug=in.(${slugs})` +
    `&created_at=gte.${encodeURIComponent(since)}` +
    `&select=cost_micro_cents&limit=10000`;
  try {
    const res = await fetch(url, { headers: headers(env), cache: "no-store" });
    if (!res.ok) {
      console.warn("[metering/store] cost sum read failed", { status: res.status });
      return 0;
    }
    const rows = (await res.json()) as { cost_micro_cents: number }[];
    return rows.reduce((sum, r) => sum + (r.cost_micro_cents ?? 0), 0);
  } catch (e) {
    console.warn("[metering/store] cost sum read failed (network)", {
      error: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
}
