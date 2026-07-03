// db.ts — data layer for pa_trial_threads + pa_moderation_events (migration 102, PA-POS-32).
// Service-role REST against PostgREST, no SDK — same posture as agent-builder/db.ts. Both
// tables are RLS-on with zero policies: cold senders aren't auth users, so this module is the
// only surface that touches them, always through webhook / cron / Stripe routes.

import { coldLog } from "./log";
import { hashPhoneForLog } from "./phone";
import type { TrialThreadRow, TrialThreadStatus } from "./types";

export type ColdDbResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const THREADS = "pa_trial_threads";
const MODERATION = "pa_moderation_events";

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

export async function fetchTrialThread(
  senderPhone: string,
): Promise<ColdDbResult<TrialThreadRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${THREADS}?sender_phone=eq.${encodeURIComponent(senderPhone)}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as TrialThreadRow[];
  return { ok: true, data: rows[0] ?? null };
}

export async function fetchTrialThreadByThreadId(
  threadId: string,
): Promise<ColdDbResult<TrialThreadRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${THREADS}?thread_id=eq.${encodeURIComponent(threadId)}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as TrialThreadRow[];
  return { ok: true, data: rows[0] ?? null };
}

export async function fetchTrialThreadByOwner(
  ownerId: string,
): Promise<ColdDbResult<TrialThreadRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${THREADS}?converted_to_owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as TrialThreadRow[];
  return { ok: true, data: rows[0] ?? null };
}

export async function insertTrialThread(params: {
  senderPhone: string;
}): Promise<ColdDbResult<TrialThreadRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(`${env.url}/rest/v1/${THREADS}`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ sender_phone: params.senderPhone }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as TrialThreadRow[];
  if (!rows[0]) return { ok: false, status: 500, error: "insert returned no row" };
  return { ok: true, data: rows[0] };
}

export type TrialThreadPatch = Partial<{
  composed_persona_slug: string | null;
  composed_apps: string[];
  composed_skill_slugs: string[];
  conversation_state: string | null;
  turn_count: number;
  actions_delivered: number;
  status: TrialThreadStatus;
  starts_in_window: number;
  window_started_at: string;
  cooloff_until: string | null;
  last_active_at: string;
  converted_to_owner_id: string | null;
}>;

export async function updateTrialThread(
  senderPhone: string,
  patch: TrialThreadPatch,
): Promise<ColdDbResult<TrialThreadRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${THREADS}?sender_phone=eq.${encodeURIComponent(senderPhone)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as TrialThreadRow[];
  if (!rows[0]) return { ok: false, status: 404, error: "thread not found" };
  return { ok: true, data: rows[0] };
}

/** Ledger a flagged inbound (§22.4). Best-effort — a ledger miss never blocks the decline. */
export async function insertModerationEvent(params: {
  senderPhone: string;
  category: string;
  body: string;
}): Promise<void> {
  const env = paEnv();
  if ("error" in env) {
    coldLog.error("moderation ledger skipped — no service env", {
      sender: hashPhoneForLog(params.senderPhone),
    });
    return;
  }
  const res = await fetch(`${env.url}/rest/v1/${MODERATION}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: "whatsapp",
      sender_phone: params.senderPhone,
      category: params.category,
      body: params.body.slice(0, 4_096),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    coldLog.error("moderation ledger write failed", {
      sender: hashPhoneForLog(params.senderPhone),
      status: res.status,
    });
  }
}

/**
 * The 14-day TTL sweep (§22.2): expire unconverted threads idle past the cutoff and drop
 * their encrypted conversation state. Idempotent — expired rows fall out of the filter.
 */
export async function sweepExpiredTrialThreads(
  cutoffIso: string,
): Promise<ColdDbResult<number>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const filter =
    `status=in.(active,paused,declined)` +
    `&last_active_at=lt.${encodeURIComponent(cutoffIso)}`;
  const res = await fetch(`${env.url}/rest/v1/${THREADS}?${filter}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      status: "expired",
      conversation_state: null,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as TrialThreadRow[];
  return { ok: true, data: rows.length };
}
