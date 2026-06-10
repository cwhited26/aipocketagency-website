// db.ts — the service-role data layer for the Ritual Scheduler (pa_rituals + pa_ritual_runs,
// migration 072). Direct PostgREST, no SDK — matches lib/followup-sweeps/db.ts and lib/pa-inbox-items.ts.
// Every function scopes by owner_id (or, for runs, by the parent ritual the caller has already gated);
// the API routes verify ownership before calling and the cron threads each ritual's owner_id through.
// Typed results, never a silent empty.

import type { Ritual, RitualDelivery, RitualLastRunStatus, RitualRun, RitualRunStatus } from "./types";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const RITUALS = "pa_rituals";
const RUNS = "pa_ritual_runs";

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase service-role env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

// ── Rituals ──────────────────────────────────────────────────────────────────────

export async function listRituals(ownerId: string): Promise<PaResult<Ritual[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${RITUALS}?owner_id=eq.${encodeURIComponent(ownerId)}&order=created_at.desc`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    // Degrade to "no rituals" until migration 072 lands, so the App surface renders pre-apply.
    if (res.status === 404 || body.includes(RITUALS)) return { ok: true, data: [] };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: (await res.json()) as Ritual[] };
}

export async function getRitual(id: string, ownerId: string): Promise<PaResult<Ritual | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${RITUALS}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(
      ownerId,
    )}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Ritual[];
  return { ok: true, data: rows[0] ?? null };
}

/** Count an owner's ACTIVE (enabled) rituals — backs the tier cap (PA-RITUAL-8). Paused don't count. */
export async function countActiveRituals(ownerId: string): Promise<PaResult<number>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${RITUALS}?owner_id=eq.${encodeURIComponent(ownerId)}&enabled=eq.true&select=id`,
    { headers: { ...authHeaders(env.key), Prefer: "count=exact" }, cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404 || body.includes(RITUALS)) return { ok: true, data: 0 };
    return { ok: false, status: res.status, error: body };
  }
  const range = res.headers.get("content-range");
  if (range) {
    const parsed = Number(range.split("/")[1]);
    if (Number.isFinite(parsed)) return { ok: true, data: parsed };
  }
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: Array.isArray(rows) ? rows.length : 0 };
}

export type CreateRitualParams = {
  ownerId: string;
  name: string;
  appSlug: string | null;
  projectPlanId: string | null;
  appPayload: Record<string, unknown>;
  scheduleCron: string;
  scheduleNaturalText: string;
  biWeeklySkip: boolean;
  delivery: RitualDelivery;
  nextRunAt: string;
};

export async function createRitual(params: CreateRitualParams): Promise<PaResult<Ritual>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${RITUALS}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: params.ownerId,
      name: params.name,
      app_slug: params.appSlug,
      project_plan_id: params.projectPlanId,
      app_payload: params.appPayload,
      schedule_cron: params.scheduleCron,
      schedule_natural_text: params.scheduleNaturalText,
      bi_weekly_skip: params.biWeeklySkip,
      delivery: params.delivery,
      enabled: true,
      next_run_at: params.nextRunAt,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Ritual[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: rows[0] };
}

export type RitualPatch = {
  name?: string;
  appPayload?: Record<string, unknown>;
  scheduleCron?: string;
  scheduleNaturalText?: string;
  biWeeklySkip?: boolean;
  delivery?: RitualDelivery;
  enabled?: boolean;
  nextRunAt?: string;
  /** Reset the failure streak (used on resume, and after a successful run). */
  resetFailures?: boolean;
};

export async function updateRitual(
  id: string,
  ownerId: string,
  patch: RitualPatch,
): Promise<PaResult<Ritual>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.appPayload !== undefined) body.app_payload = patch.appPayload;
  if (patch.scheduleCron !== undefined) body.schedule_cron = patch.scheduleCron;
  if (patch.scheduleNaturalText !== undefined) body.schedule_natural_text = patch.scheduleNaturalText;
  if (patch.biWeeklySkip !== undefined) body.bi_weekly_skip = patch.biWeeklySkip;
  if (patch.delivery !== undefined) body.delivery = patch.delivery;
  if (patch.enabled !== undefined) body.enabled = patch.enabled;
  if (patch.nextRunAt !== undefined) body.next_run_at = patch.nextRunAt;
  if (patch.resetFailures) body.consecutive_failures = 0;

  const res = await fetch(
    `${env.url}/rest/v1/${RITUALS}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Ritual[];
  if (!rows[0]) return { ok: false, status: 404, error: "Ritual not found." };
  return { ok: true, data: rows[0] };
}

export async function deleteRitual(id: string, ownerId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${RITUALS}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    { method: "DELETE", headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

// Enabled rituals whose next_run_at is due — the every-5-minutes cron's work list (SPEC §6, PA-RITUAL-4).
export async function fetchDueRituals(limit = 50): Promise<PaResult<Ritual[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = encodeURIComponent(new Date().toISOString());
  const res = await fetch(
    `${env.url}/rest/v1/${RITUALS}` +
      `?enabled=eq.true&next_run_at=lte.${now}` +
      `&order=next_run_at.asc&limit=${limit}`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    // Degrade to "nothing due" until migration 072 lands, so the cron stays green pre-apply.
    if (res.status === 404 || body.includes(RITUALS)) return { ok: true, data: [] };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: (await res.json()) as Ritual[] };
}

/** Apply the post-run state to a ritual: advance the cursor, stamp the outcome, and (on the failure
 *  streak hitting the cap) pause it. Service-role; the run executor computes the fields. */
export async function applyRunOutcome(
  id: string,
  outcome: {
    nextRunAt: string;
    lastRunAt: string;
    status: RitualLastRunStatus;
    consecutiveFailures: number;
    enabled: boolean;
  },
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${RITUALS}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      next_run_at: outcome.nextRunAt,
      last_run_at: outcome.lastRunAt,
      last_run_status: outcome.status,
      consecutive_failures: outcome.consecutiveFailures,
      enabled: outcome.enabled,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

// ── Runs ─────────────────────────────────────────────────────────────────────────

export async function insertRitualRun(ritualId: string): Promise<PaResult<RitualRun>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${RUNS}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ ritual_id: ritualId, status: "running" satisfies RitualRunStatus }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as RitualRun[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after run insert." };
  return { ok: true, data: rows[0] };
}

export async function finishRitualRun(
  runId: string,
  outcome: {
    status: Exclude<RitualRunStatus, "running">;
    resultCardId: string | null;
    errorText: string | null;
    costMicroCents: number;
  },
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${RUNS}?id=eq.${encodeURIComponent(runId)}`, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      status: outcome.status,
      result_card_id: outcome.resultCardId,
      error_text: outcome.errorText,
      cost_micro_cents: outcome.costMicroCents,
      finished_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** A ritual's recent runs, newest first, for the detail page. Caller gates ownership via getRitual. */
export async function listRitualRuns(ritualId: string, limit = 50): Promise<PaResult<RitualRun[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${RUNS}?ritual_id=eq.${encodeURIComponent(ritualId)}&order=started_at.desc&limit=${limit}`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404 || body.includes(RUNS)) return { ok: true, data: [] };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: (await res.json()) as RitualRun[] };
}
