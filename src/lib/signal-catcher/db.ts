// db.ts — the service-role data layer for the Signal Catcher (pa_signal_catches +
// pa_signal_catcher_settings, migration 103). Direct PostgREST, no SDK — matches
// lib/rituals/db.ts. Every function scopes by owner_id; the API routes verify ownership before
// calling and the chat hook threads the owner through. Reads degrade to empty/defaults until
// migration 103 lands so the chat path and the App surface never brick pre-apply; writes fail
// loudly (a dropped catch is a logged error, not a silent nothing).

import {
  DEFAULT_SETTINGS,
  isSensitivity,
  type SignalCatch,
  type SignalCatchStatus,
  type SignalCatcherSettings,
  type SignalType,
} from "./types";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const CATCHES = "pa_signal_catches";
const SETTINGS = "pa_signal_catcher_settings";

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

// ── Catches ─────────────────────────────────────────────────────────────────────────

export type InsertSignalCatchParams = {
  ownerId: string;
  conversationId: string | null;
  userMessageId: string | null;
  quote: string;
  signalType: SignalType;
  confidence: number;
  ritualName: string;
  cadence: string;
  appSlug: string;
  themeKey: string;
  status: SignalCatchStatus;
  inboxItemId: string | null;
};

export async function insertSignalCatch(
  params: InsertSignalCatchParams,
): Promise<PaResult<SignalCatch>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${CATCHES}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: params.ownerId,
      source_persona_chat_id: params.conversationId,
      user_message_id: params.userMessageId,
      quote: params.quote,
      classified_signal_type: params.signalType,
      confidence: params.confidence,
      suggested_ritual_name: params.ritualName,
      suggested_cadence: params.cadence,
      suggested_app_slug: params.appSlug,
      theme_key: params.themeKey,
      status: params.status,
      inbox_item_id: params.inboxItemId,
      ...(params.status === "pending_review" ? {} : { resolved_at: new Date().toISOString() }),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as SignalCatch[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: rows[0] };
}

/** Patch a catch after staging its card (the card id lands after the row exists). */
export async function attachInboxItem(
  id: string,
  ownerId: string,
  inboxItemId: string,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${CATCHES}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ inbox_item_id: inboxItemId }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

export async function resolveSignalCatch(
  id: string,
  ownerId: string,
  outcome: { status: Exclude<SignalCatchStatus, "pending_review">; ritualId?: string | null },
): Promise<PaResult<SignalCatch | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${CATCHES}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        status: outcome.status,
        resolved_at: new Date().toISOString(),
        ...(outcome.ritualId !== undefined ? { ritual_id: outcome.ritualId } : {}),
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as SignalCatch[];
  return { ok: true, data: rows[0] ?? null };
}

/** The owner's catch history, newest first — the /app/apps/signal-catcher surface. */
export async function listSignalCatches(
  ownerId: string,
  limit = 100,
): Promise<PaResult<SignalCatch[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${CATCHES}?owner_id=eq.${encodeURIComponent(ownerId)}&order=created_at.desc&limit=${limit}`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    // Degrade to "no catches" until migration 103 lands, so the surface renders pre-apply.
    if (res.status === 404 || body.includes(CATCHES)) return { ok: true, data: [] };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: (await res.json()) as SignalCatch[] };
}

/** Catches inside the widest dedup window (30 days) — what evaluateSignalDedup reads. */
export async function listRecentCatches(
  ownerId: string,
  sinceIso: string,
): Promise<PaResult<SignalCatch[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${CATCHES}?owner_id=eq.${encodeURIComponent(ownerId)}` +
      `&created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.desc&limit=500`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404 || body.includes(CATCHES)) return { ok: true, data: [] };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: (await res.json()) as SignalCatch[] };
}

export async function fetchSignalCatchById(
  id: string,
  ownerId: string,
): Promise<PaResult<SignalCatch | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${CATCHES}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as SignalCatch[];
  return { ok: true, data: rows[0] ?? null };
}

// ── Settings ────────────────────────────────────────────────────────────────────────

/** The owner's toggle + sensitivity. No ROW → the defaults (ON, medium). No TABLE (migration 103
 *  not applied yet) → disabled — fail closed so the catcher never spends a classification it has
 *  nowhere to store. */
export async function fetchSignalCatcherSettings(
  ownerId: string,
): Promise<PaResult<SignalCatcherSettings>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${SETTINGS}?owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404 || body.includes(SETTINGS)) {
      return { ok: true, data: { ...DEFAULT_SETTINGS, enabled: false } };
    }
    return { ok: false, status: res.status, error: body };
  }
  const rows = (await res.json()) as Array<{ enabled: boolean; sensitivity: string }>;
  const row = rows[0];
  if (!row) return { ok: true, data: DEFAULT_SETTINGS };
  return {
    ok: true,
    data: {
      enabled: row.enabled,
      sensitivity: isSensitivity(row.sensitivity) ? row.sensitivity : DEFAULT_SETTINGS.sensitivity,
    },
  };
}

/** Upsert the owner's settings (owner_id is the PK, so merge-duplicates needs no on_conflict). */
export async function saveSignalCatcherSettings(
  ownerId: string,
  settings: SignalCatcherSettings,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${SETTINGS}`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      owner_id: ownerId,
      enabled: settings.enabled,
      sensitivity: settings.sensitivity,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
