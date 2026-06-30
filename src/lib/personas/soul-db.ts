// soul-db.ts — data layer for pa_persona_souls. Plain fetch against the Supabase REST API with the
// service-role key (no SDK — repo rule), matching persona-memory/db.ts and pa-inbox-items.ts. RLS
// lets the owner SELECT their own rows (defense-in-depth); every function scopes by persona_id and/or
// owner_id, and the calling routes enforce persona ownership before mutating.
//
// Append-only with supersession: an attribute is never contradicted in place — a new row is inserted
// and the old row's superseded_by is pointed at it. The owner "Forget" action retires (supersedes) an
// attribute rather than hard-deleting, keeping the Soul's history intact (SPEC §Owner controls).

import {
  isSoulAttributeKind,
  type SoulAttributeKind,
  type SoulAttributeRow,
} from "./soul-types";

const TABLE = "pa_persona_souls";

export type SoulResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export type SoulListResult =
  | { ok: true; data: SoulAttributeRow[]; degraded?: "table_missing" }
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

// Narrow a raw PostgREST row into the typed row, dropping anything malformed. attribute_kind is
// CHECK-constrained at the DB layer; we still validate so a bad row can never reach the LLM untyped.
function coerceRow(raw: unknown): SoulAttributeRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = typeof r.attribute_kind === "string" ? r.attribute_kind : "";
  if (!isSoulAttributeKind(kind)) return null;
  if (typeof r.id !== "string" || typeof r.attribute_summary !== "string") return null;
  return {
    id: r.id,
    persona_id: typeof r.persona_id === "string" ? r.persona_id : "",
    owner_id: typeof r.owner_id === "string" ? r.owner_id : "",
    attribute_kind: kind,
    attribute_summary: r.attribute_summary,
    attribute_body: typeof r.attribute_body === "string" ? r.attribute_body : null,
    confidence: typeof r.confidence === "number" ? r.confidence : 0.5,
    source_session_id: typeof r.source_session_id === "string" ? r.source_session_id : null,
    locked: r.locked === true,
    superseded_by: typeof r.superseded_by === "string" ? r.superseded_by : null,
    created_at: typeof r.created_at === "string" ? r.created_at : "",
    updated_at: typeof r.updated_at === "string" ? r.updated_at : "",
  };
}

function coerceRows(raw: unknown): SoulAttributeRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceRow).filter((r): r is SoulAttributeRow => r !== null);
}

// ── Insert ──────────────────────────────────────────────────────────────────────────────

export type InsertSoulInput = {
  personaId: string;
  ownerId: string;
  kind: SoulAttributeKind;
  summary: string;
  body?: string | null;
  confidence: number;
  sourceSessionId?: string | null;
  locked?: boolean;
};

export async function insertSoulAttribute(
  input: InsertSoulInput,
): Promise<SoulResult<SoulAttributeRow>> {
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
      persona_id: input.personaId,
      owner_id: input.ownerId,
      attribute_kind: input.kind,
      attribute_summary: input.summary,
      attribute_body: input.body ?? null,
      confidence: input.confidence,
      source_session_id: input.sourceSessionId ?? null,
      locked: input.locked ?? false,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const row = coerceRow((await res.json())[0]);
  if (!row) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: row };
}

// ── Reads ─────────────────────────────────────────────────────────────────────────────

/** Live (not-superseded) attributes for one persona — the read-path + cap scope. */
export async function listLiveForPersona(personaId: string): Promise<SoulListResult> {
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

/** Count of one persona's LIVE attributes — the per-persona tier-cap denominator (SPEC §Tier gating). */
export async function countLiveForPersona(personaId: string): Promise<SoulResult<number>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?persona_id=eq.${encodeURIComponent(personaId)}&superseded_by=is.null&select=id`,
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

/** Fetch one attribute by id (ownership verified by the caller). */
export async function fetchSoulById(id: string): Promise<SoulResult<SoulAttributeRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: coerceRow((await res.json())[0]) ?? null };
}

// ── Mutations ────────────────────────────────────────────────────────────────────────────

/** Point an attribute's superseded_by at `bySupersederId`, retiring it from the live set without
 *  deleting it. Used by the supersession merge and the owner "Forget" action. */
export async function supersedeSoulAttribute(
  victimId: string,
  bySupersederId: string,
): Promise<SoulResult<true>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(victimId)}`, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
    body: JSON.stringify({ superseded_by: bySupersederId, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: true };
}

/** Owner "Forget" (SPEC §Owner controls): retire an attribute by pointing superseded_by at itself —
 *  a valid self-FK that satisfies the not-superseded read filter. Scoped to its persona so a stray id
 *  can't retire another persona's attribute. Keeps the row for history, unlike a hard delete. */
export async function retireSoulAttribute(id: string, personaId: string): Promise<SoulResult<true>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&persona_id=eq.${encodeURIComponent(personaId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
      body: JSON.stringify({ superseded_by: id, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: true };
}

/** Owner "Edit" (SPEC §Owner controls): rewrite an attribute's summary/body in place. Scoped to its
 *  persona. An owner edit is a deliberate correction, so updating in place (not superseding) is right. */
export async function updateSoulFields(
  id: string,
  personaId: string,
  fields: { summary?: string; body?: string | null },
): Promise<SoulResult<SoulAttributeRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.summary !== undefined) patch.attribute_summary = fields.summary;
  if (fields.body !== undefined) patch.attribute_body = fields.body;
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&persona_id=eq.${encodeURIComponent(personaId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const row = coerceRow((await res.json())[0]);
  if (!row) return { ok: false, status: 404, error: "Attribute not found." };
  return { ok: true, data: row };
}

/** Owner "Lock"/"Unlock" (SPEC §Owner controls): toggle decay exemption. Scoped to its persona. */
export async function setSoulLocked(
  id: string,
  personaId: string,
  locked: boolean,
): Promise<SoulResult<SoulAttributeRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&persona_id=eq.${encodeURIComponent(personaId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ locked, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const row = coerceRow((await res.json())[0]);
  if (!row) return { ok: false, status: 404, error: "Attribute not found." };
  return { ok: true, data: row };
}
