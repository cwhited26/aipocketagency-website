// schedule.ts — the scheduling cursor + cron data layer for Lead Scout re-runs (Phase 3).
//
// A Lead Source's `schedule` ('on_demand' | 'daily' | 'weekly') drives a next_run_at cursor on the
// source row. The /api/cron/lead-scout cron (registered on the same */15 sweep as the other PA crons)
// reads every source whose next_run_at is due, re-runs the scrape, auto-stages outreach for the hot
// + warm leads, and advances the cursor. An 'on_demand' source carries a null cursor and is never
// picked up — it only runs when the owner taps "Run now".
//
// Service-role PostgREST (the cron has no user session); the source rows already scope work by
// owner_id, which the cron threads through to resolve each owner's keys.

import type { LeadScoutSchedule, LeadScoutSource } from "./types";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The next-run ISO for a schedule, measured from `from`. Daily = +1 day, weekly = +7 days; on_demand
 * has no cursor (returns null). Plain interval-from-now semantics — predictable and DST-proof, no cron
 * parsing needed for the three fixed cadences Lead Scout offers.
 */
export function nextRunFor(schedule: LeadScoutSchedule, from: Date = new Date()): string | null {
  switch (schedule) {
    case "daily":
      return new Date(from.getTime() + DAY_MS).toISOString();
    case "weekly":
      return new Date(from.getTime() + 7 * DAY_MS).toISOString();
    case "on_demand":
    default:
      return null;
  }
}

// Sources due for a scheduled re-run: a non-on_demand schedule with next_run_at in the past.
export async function fetchDueLeadSources(): Promise<PaResult<LeadScoutSource[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = encodeURIComponent(new Date().toISOString());
  const endpoint =
    `${env.url}/rest/v1/pa_lead_scout_sources` +
    `?schedule=neq.on_demand&next_run_at=not.is.null&next_run_at=lte.${now}` +
    `&order=next_run_at.asc&limit=50`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    // The next_run_at column is added by migration 051; if it hasn't landed yet, degrade to "nothing
    // due" rather than a hard 500 so the cron stays green until the migration is applied.
    if (res.status === 404 || body.includes("next_run_at")) return { ok: true, data: [] };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: (await res.json()) as LeadScoutSource[] };
}

// Advance a source's cursor after a scheduled run (success or failure both advance, so a broken
// source doesn't hammer the cron every 15 minutes — it retries on its normal cadence).
export async function markLeadSourceRun(
  id: string,
  params: { schedule: LeadScoutSchedule; ranAt: Date },
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/pa_lead_scout_sources?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        last_run_at: params.ranAt.toISOString(),
        next_run_at: nextRunFor(params.schedule, params.ranAt),
        updated_at: params.ranAt.toISOString(),
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
