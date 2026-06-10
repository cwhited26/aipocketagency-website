// db.ts — data layer for pa_persona_memory. Plain fetch against the Supabase REST API with the
// service-role key (no SDK), matching pa-inbox-items.ts / pa-connections.ts. RLS lets the owner SELECT
// their own rows (defense-in-depth); every function here scopes by owner_id and/or persona_id, and the
// calling routes enforce persona ownership before mutating.
//
// Append-only with supersession: a memory is never UPDATEd in place — it is replaced by inserting a
// new row and pointing the old row's superseded_by at it. Hard DELETE is reserved for the owner-facing
// "forget" actions (PA-MEM-5), which must actually remove the data, not just hide it.

import {
  isMemoryPartition,
  isMemoryTier,
  type MemoryPartition,
  type MemoryTier,
  type PersonaMemoryRow,
} from "./types";

const TABLE = "pa_persona_memory";

export type MemoryResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export type MemoryListResult =
  | { ok: true; data: PersonaMemoryRow[]; degraded?: "table_missing" }
  | { ok: false; status: number; error: string };

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

function isMissingTable(status: number, body: string): boolean {
  if (status !== 404) return false;
  return body.includes("PGRST205") || body.includes(TABLE) || body.includes("does not exist");
}

// Narrow a raw PostgREST row into the typed row, dropping anything malformed. partition/tier are
// CHECK-constrained at the DB layer; we still validate so a bad row can never reach the LLM untyped.
function coerceRow(raw: unknown): PersonaMemoryRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const partition = typeof r.partition === "string" ? r.partition : "";
  const tier = typeof r.tier === "string" ? r.tier : "";
  if (!isMemoryPartition(partition) || !isMemoryTier(tier)) return null;
  if (typeof r.id !== "string" || typeof r.body !== "string") return null;
  return {
    id: r.id,
    owner_id: typeof r.owner_id === "string" ? r.owner_id : "",
    persona_id: typeof r.persona_id === "string" ? r.persona_id : "",
    partition,
    tier,
    conversation_id: typeof r.conversation_id === "string" ? r.conversation_id : null,
    body: r.body,
    importance: typeof r.importance === "number" ? r.importance : 5,
    contact_ref: typeof r.contact_ref === "string" ? r.contact_ref : null,
    untrusted_origin: r.untrusted_origin === true,
    source_event_id: typeof r.source_event_id === "string" ? r.source_event_id : null,
    superseded_by: typeof r.superseded_by === "string" ? r.superseded_by : null,
    created_at: typeof r.created_at === "string" ? r.created_at : "",
    last_read_at: typeof r.last_read_at === "string" ? r.last_read_at : null,
  };
}

function coerceRows(raw: unknown): PersonaMemoryRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceRow).filter((r): r is PersonaMemoryRow => r !== null);
}

// ── Insert ──────────────────────────────────────────────────────────────────────────────

export type InsertMemoryInput = {
  ownerId: string;
  personaId: string;
  partition: MemoryPartition;
  tier: MemoryTier;
  body: string;
  importance: number;
  conversationId?: string | null;
  contactRef?: string | null;
  untrustedOrigin?: boolean;
  sourceEventId?: string | null;
};

export async function insertMemory(
  input: InsertMemoryInput,
): Promise<MemoryResult<PersonaMemoryRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      owner_id: input.ownerId,
      persona_id: input.personaId,
      partition: input.partition,
      tier: input.tier,
      body: input.body,
      importance: input.importance,
      conversation_id: input.conversationId ?? null,
      contact_ref: input.contactRef ?? null,
      untrusted_origin: input.untrustedOrigin ?? false,
      source_event_id: input.sourceEventId ?? null,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const row = coerceRow((await res.json())[0]);
  if (!row) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: row };
}

// ── Reads ─────────────────────────────────────────────────────────────────────────────

/** Live (not-superseded) memories for one persona — the read-path + cap scope. */
export async function listLiveForPersona(personaId: string): Promise<MemoryListResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?persona_id=eq.${encodeURIComponent(personaId)}` +
      `&superseded_by=is.null&order=created_at.desc&limit=2000`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body)) return { ok: true, data: [], degraded: "table_missing" };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: coerceRows(await res.json()) };
}

/** Every memory for one persona (live first), for the owner-facing inspector. */
export async function listAllForPersona(personaId: string): Promise<MemoryListResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?persona_id=eq.${encodeURIComponent(personaId)}` +
      `&order=created_at.desc&limit=2000`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body)) return { ok: true, data: [], degraded: "table_missing" };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: coerceRows(await res.json()) };
}

/** Count of an owner's LIVE memories across all Personas — the tier-cap denominator (SPEC §9). */
export async function countLiveForOwner(ownerId: string): Promise<MemoryResult<number>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}&superseded_by=is.null&select=id`,
    { headers: { ...authHeaders(env.key), Prefer: "count=exact" }, cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body)) return { ok: true, data: 0 };
    return { ok: false, status: res.status, error: body };
  }
  const range = res.headers.get("content-range");
  if (range) {
    const total = Number(range.split("/")[1]);
    if (Number.isFinite(total)) return { ok: true, data: total };
  }
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: Array.isArray(rows) ? rows.length : 0 };
}

/** The lowest-importance live memory across an owner's Personas (oldest on a tie) — the overflow
 *  pruner's victim (SPEC §9). One row, picked DB-side, so the over-cap path never fetches the whole
 *  set. Mirrors prune.ts `selectOverflowVictim`, which encodes the same rule for the unit tests. */
export async function fetchOverflowVictimForOwner(
  ownerId: string,
): Promise<MemoryResult<PersonaMemoryRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}&superseded_by=is.null` +
      `&order=importance.asc,created_at.asc&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    if (isMissingTable(res.status, body)) return { ok: true, data: null };
    return { ok: false, status: res.status, error: body };
  }
  return { ok: true, data: coerceRow((await res.json())[0]) ?? null };
}

/** Fetch one memory by id (ownership verified by the caller). */
export async function fetchMemoryById(id: string): Promise<MemoryResult<PersonaMemoryRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: coerceRow((await res.json())[0]) ?? null };
}

// ── Supersession (the append-only "replace") ────────────────────────────────────────────

/** Point a memory's superseded_by at `bySupersederId` (or any non-null marker), retiring it from the
 *  live set without deleting it. Used by the overflow pruner and the owner "supersede" action. */
export async function supersedeMemory(
  victimId: string,
  bySupersederId: string,
): Promise<MemoryResult<true>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(victimId)}`, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
    body: JSON.stringify({ superseded_by: bySupersederId }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: true };
}

/** Owner-initiated "supersede" with no replacement: retire a memory from the live set by pointing its
 *  superseded_by at itself (a valid FK that satisfies the not-superseded read filter). Scoped to its
 *  persona so a stray id can't retire another persona's memory. Keeps the row for audit, unlike delete. */
export async function retireMemory(id: string, personaId: string): Promise<MemoryResult<true>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&persona_id=eq.${encodeURIComponent(personaId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
      body: JSON.stringify({ superseded_by: id }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: true };
}

// ── Hard delete (the owner "forget" actions, PA-MEM-5) ──────────────────────────────────

/** Hard-delete one memory, scoped to its persona so a stray id can't touch another persona's rows. */
export async function deleteMemory(id: string, personaId: string): Promise<MemoryResult<true>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&persona_id=eq.${encodeURIComponent(personaId)}`,
    { method: "DELETE", headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: true };
}

/** Forget everything about one named contact for a persona ("Forget everything about [Contact]"). */
export async function deleteByContact(
  personaId: string,
  contactRef: string,
): Promise<MemoryResult<true>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?persona_id=eq.${encodeURIComponent(personaId)}&contact_ref=eq.${encodeURIComponent(contactRef)}`,
    { method: "DELETE", headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: true };
}

/** The nuclear button: forget everything this persona believes about the owner (SPEC §8). */
export async function deleteAllForPersona(personaId: string): Promise<MemoryResult<true>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?persona_id=eq.${encodeURIComponent(personaId)}`,
    { method: "DELETE", headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: true };
}
