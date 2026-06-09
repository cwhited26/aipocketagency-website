// db.ts — the service-role data layer for Follow-Up Sweeps (pa_followup_sweep_sources +
// pa_followup_sweep_contacts, migration 063). Direct PostgREST, no SDK — matches lib/leads/source.ts
// and lib/pa-inbox-items.ts. Every function scopes by owner_id; the API routes gate ownership before
// calling and the cron threads each source's owner_id through. Typed results, never a silent empty.

import {
  DEFAULT_DORMANCY_DAYS,
  SWEEP_INTERVAL_DAYS,
  type FollowupSourceConfig,
  type FollowupSourceType,
  type FollowupSweepContact,
  type FollowupSweepSource,
} from "./types";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const SOURCES = "pa_followup_sweep_sources";
const CONTACTS = "pa_followup_sweep_contacts";
const DAY_MS = 24 * 60 * 60 * 1000;

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

/** The next-sweep cursor: a fixed interval from `from` (weekly cadence, PA-FUS-4). */
export function nextSweepAt(from: Date = new Date()): string {
  return new Date(from.getTime() + SWEEP_INTERVAL_DAYS * DAY_MS).toISOString();
}

// ─── Sources ─────────────────────────────────────────────────────────────────

export async function listSources(ownerId: string): Promise<PaResult<FollowupSweepSource[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${SOURCES}?owner_id=eq.${encodeURIComponent(ownerId)}&order=created_at.desc`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as FollowupSweepSource[] };
}

export async function getSource(
  id: string,
  ownerId: string,
): Promise<PaResult<FollowupSweepSource | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${SOURCES}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(
      ownerId,
    )}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as FollowupSweepSource[];
  return { ok: true, data: rows[0] ?? null };
}

export async function createSource(params: {
  ownerId: string;
  sourceType: FollowupSourceType;
  config: FollowupSourceConfig;
  /** Owner override; falls back to the relationship default (PA-FUS-1). */
  dormancyDays?: number;
}): Promise<PaResult<FollowupSweepSource>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const dormancy = params.dormancyDays ?? DEFAULT_DORMANCY_DAYS[params.config.relationship];

  const res = await fetch(`${env.url}/rest/v1/${SOURCES}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: params.ownerId,
      source_type: params.sourceType,
      source_config: params.config,
      dormancy_days: dormancy,
      enabled: true,
      // A fresh source is due immediately, so the next weekly cron (or a manual sweep) picks it up.
      next_sweep_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as FollowupSweepSource[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: rows[0] };
}

export async function updateSource(
  id: string,
  ownerId: string,
  patch: Partial<Pick<FollowupSweepSource, "enabled" | "dormancy_days" | "source_config">>,
): Promise<PaResult<FollowupSweepSource>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) body.enabled = patch.enabled;
  if (patch.dormancy_days !== undefined) body.dormancy_days = patch.dormancy_days;
  if (patch.source_config !== undefined) body.source_config = patch.source_config;

  const res = await fetch(
    `${env.url}/rest/v1/${SOURCES}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as FollowupSweepSource[];
  if (!rows[0]) return { ok: false, status: 404, error: "Source not found." };
  return { ok: true, data: rows[0] };
}

export async function deleteSource(id: string, ownerId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${SOURCES}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    { method: "DELETE", headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Enabled sources whose next_sweep_at is due (or unset) — the weekly cron's work list (PA-FUS-4). */
export async function fetchDueSources(): Promise<PaResult<FollowupSweepSource[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = encodeURIComponent(new Date().toISOString());
  const res = await fetch(
    `${env.url}/rest/v1/${SOURCES}` +
      `?enabled=eq.true&or=(next_sweep_at.is.null,next_sweep_at.lte.${now})` +
      `&order=next_sweep_at.asc.nullsfirst&limit=200`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    // Degrade to "nothing due" until migration 063 lands, so the cron stays green pre-apply.
    if (res.status === 404 || body.includes(SOURCES)) return { ok: true, data: [] };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: (await res.json()) as FollowupSweepSource[] };
}

/** Advance a source's sweep cursor after a run (success or failure both advance — PA-FUS-4). */
export async function markSourceSwept(id: string, sweptAt: Date = new Date()): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${SOURCES}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      last_swept_at: sweptAt.toISOString(),
      next_sweep_at: nextSweepAt(sweptAt),
      updated_at: sweptAt.toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function listContactsForSource(
  sourceId: string,
  ownerId: string,
): Promise<PaResult<FollowupSweepContact[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${CONTACTS}?source_id=eq.${encodeURIComponent(
      sourceId,
    )}&owner_id=eq.${encodeURIComponent(ownerId)}&order=last_touched_at.asc.nullsfirst`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as FollowupSweepContact[] };
}

/**
 * Upsert one discovered contact for a source. Conflict target is (source_id, contact_email): a
 * re-sweep refreshes the touch date + name but PRESERVES suppressed and last_drafted_at (we only set
 * the columns discovery owns), so a "leave alone" flag and the re-draft cooldown both survive a
 * re-sweep. Returns the persisted row.
 */
export async function upsertContact(params: {
  ownerId: string;
  sourceId: string;
  contactEmail: string;
  contactName: string | null;
  lastTouchedAt: string | null;
}): Promise<PaResult<FollowupSweepContact>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${CONTACTS}?on_conflict=source_id,contact_email`,
    {
      method: "POST",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        // merge-duplicates updates the conflicting row; the body omits suppressed/last_drafted_at so
        // their existing values are kept.
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        owner_id: params.ownerId,
        source_id: params.sourceId,
        contact_email: params.contactEmail,
        contact_name: params.contactName,
        last_touched_at: params.lastTouchedAt,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as FollowupSweepContact[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after upsert." };
  return { ok: true, data: rows[0] };
}

/** Stamp a contact's last_drafted_at after a draft stages — backs the 7-day re-draft guard. */
export async function stampContactDrafted(
  id: string,
  ownerId: string,
  at: Date = new Date(),
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${CONTACTS}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ last_drafted_at: at.toISOString(), updated_at: at.toISOString() }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Set (or clear) a contact's suppressed flag — the persistent "leave alone" (PA-FUS-5). */
export async function setContactSuppressed(
  id: string,
  ownerId: string,
  suppressed: boolean,
): Promise<PaResult<FollowupSweepContact>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${CONTACTS}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ suppressed, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as FollowupSweepContact[];
  if (!rows[0]) return { ok: false, status: 404, error: "Contact not found." };
  return { ok: true, data: rows[0] };
}
