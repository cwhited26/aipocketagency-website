// pa-routines.ts — data layer for pocket_agent_routines
// All writes use the service-role key. RLS allows users to SELECT their own rows.
// No SDK — plain fetch against the Supabase REST API (same pattern as pa-supabase.ts).

import { ROUTINE_KINDS, ROUTINE_DEFS } from "./routine-meta";
export { ROUTINE_KINDS, ROUTINE_DEFS } from "./routine-meta";
export type { RoutineKind, RoutineDef } from "./routine-meta";

export type Routine = {
  id: string;
  user_id: string;
  kind: (typeof ROUTINE_KINDS)[number];
  enabled: boolean;
  schedule_cron: string;
  last_run_at: string | null;
  next_run_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

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

const TABLE = "pocket_agent_routines";

// ─── Time helpers ─────────────────────────────────────────────────────────────

export function computeNextRun(cron: string): Date {
  const parts = cron.trim().split(/\s+/);
  const minute = parseInt(parts[0], 10);
  const hour = parseInt(parts[1], 10);
  const dowPart = parts[4];

  const now = new Date();
  const candidate = new Date(now);
  candidate.setUTCHours(hour, minute, 0, 0);

  if (dowPart === "*") {
    // Daily schedule
    if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);
    return candidate;
  }

  // Weekly on specific weekday (0=Sun, 1=Mon ... 6=Sat)
  const targetDow = parseInt(dowPart, 10);
  const curDow = candidate.getUTCDay();
  let daysAhead = (targetDow - curDow + 7) % 7;
  if (daysAhead === 0 && candidate <= now) daysAhead = 7;
  candidate.setUTCDate(candidate.getUTCDate() + daysAhead);
  return candidate;
}

// ─── Ensure defaults exist for user ──────────────────────────────────────────

export async function ensureUserRoutines(userId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const rows = ROUTINE_KINDS.map((kind) => ({
    user_id: userId,
    kind,
    enabled: true,
    schedule_cron: ROUTINE_DEFS[kind].scheduleCron,
    next_run_at: computeNextRun(ROUTINE_DEFS[kind].scheduleCron).toISOString(),
  }));

  // on_conflict MUST name the (user_id, kind) unique constraint. Without it,
  // PostgREST's ignore-duplicates resolution only targets the primary key (id) —
  // and since each row gets a fresh server-generated id there is never a PK
  // conflict, so the (user_id, kind) unique constraint throws 23505 on re-seed.
  // ignore-duplicates → ON CONFLICT DO NOTHING, preserving any user edits
  // (toggled enabled state, customized next_run_at) on subsequent loads.
  const res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=user_id,kind`, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  });

  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listRoutines(userId: string): Promise<PaResult<Routine[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&order=kind.asc`,
    {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    },
  );

  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Routine[];
  return { ok: true, data: rows };
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

export async function toggleRoutine(
  userId: string,
  kind: (typeof ROUTINE_KINDS)[number],
  enabled: boolean,
): Promise<PaResult<{ kind: string; enabled: boolean; next_run_at: string | null }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const nextRunAt = enabled
    ? computeNextRun(ROUTINE_DEFS[kind].scheduleCron).toISOString()
    : null;

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&kind=eq.${kind}`,
    {
      method: "PATCH",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        enabled,
        next_run_at: nextRunAt,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: { kind, enabled, next_run_at: nextRunAt } };
}

// ─── Cron helpers (service-role only) ─────────────────────────────────────────

export async function fetchDueRoutines(): Promise<PaResult<Routine[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = encodeURIComponent(new Date().toISOString());
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?enabled=eq.true&next_run_at=lte.${now}&order=next_run_at.asc&limit=50`,
    {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    },
  );

  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Routine[];
  return { ok: true, data: rows };
}

export async function markRoutineRun(
  id: string,
  params: { lastRunAt: string; nextRunAt: string; lastError: string | null },
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      last_run_at: params.lastRunAt,
      next_run_at: params.nextRunAt,
      last_error: params.lastError,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });

  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
