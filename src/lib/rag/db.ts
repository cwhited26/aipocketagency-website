// db.ts — service-role REST access to the pa_rag_indexes catalog (migration 054). Direct PostgREST
// (no SDK — repo rule). The catalog records, per (owner, zone): the embedding model the index was
// built with, the corpus size (the Node tier reads this to decide vector-vs-grep without re-listing
// the zone), the build status, and last_built_at (the daily cron reads this to find stale zones).
//
// The build claim is the idempotency seam: claimBuild() flips status idle/ready/error → building
// only when it is NOT already building, so two concurrent dispatches can't both fire a Modal build.

import { normalizeZonePath } from "./types";

export type RagIndexStatus = "idle" | "building" | "ready" | "error";

export type RagIndexRow = {
  id: string;
  owner_id: string;
  zone_path: string;
  embedding_model: string;
  doc_count: number;
  token_count: number;
  status: RagIndexStatus;
  last_built_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function paEnv(): { url: string; key: string } | null {
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

function headers(key: string, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
}

const TABLE = "pa_rag_indexes";

/** Reads the catalog row for a (owner, zone), or null when none exists / env missing. */
export async function getRagIndex(ownerId: string, zonePath: string): Promise<RagIndexRow | null> {
  const env = paEnv();
  if (!env) return null;
  const zone = normalizeZonePath(zonePath);
  const url =
    `${env.url}/rest/v1/${TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&zone_path=eq.${encodeURIComponent(zone)}` +
    `&limit=1`;
  const res = await fetch(url, { headers: headers(env.key), cache: "no-store" });
  if (!res.ok) return null;
  const rows = (await res.json()) as RagIndexRow[];
  return rows[0] ?? null;
}

/** Lists every 'ready' catalog row across all owners (cron entry point). */
export async function listReadyRagIndexes(): Promise<RagIndexRow[]> {
  const env = paEnv();
  if (!env) return [];
  const url = `${env.url}/rest/v1/${TABLE}?status=eq.ready&order=last_built_at.asc&limit=2000`;
  const res = await fetch(url, { headers: headers(env.key), cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as RagIndexRow[];
}

/** Ensures a catalog row exists for a (owner, zone). Idempotent upsert on the unique index. */
export async function ensureRagIndex(
  ownerId: string,
  zonePath: string,
  embeddingModel: string,
): Promise<void> {
  const env = paEnv();
  if (!env) return;
  const zone = normalizeZonePath(zonePath);
  const res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=owner_id,zone_path`, {
    method: "POST",
    headers: headers(env.key, { Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({
      owner_id: ownerId,
      zone_path: zone,
      embedding_model: embeddingModel,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok && res.status !== 409) {
    console.warn("[rag/db] ensureRagIndex failed", { status: res.status });
  }
}

/**
 * Atomically claim the build for a (owner, zone): flip status → 'building' only when it is NOT
 * already 'building'. PostgREST PATCH with a `status=neq.building` filter is the atomic compare —
 * the row is returned only when the update actually applied, so a concurrent dispatch that lost the
 * race gets an empty array back and we report `claimed: false` (the idempotency guarantee).
 *
 * Creates the row first (ensureRagIndex) so a never-built zone can still be claimed.
 */
export async function claimBuild(
  ownerId: string,
  zonePath: string,
  embeddingModel: string,
): Promise<{ claimed: boolean }> {
  const env = paEnv();
  if (!env) return { claimed: false };
  await ensureRagIndex(ownerId, zonePath, embeddingModel);

  const zone = normalizeZonePath(zonePath);
  const url =
    `${env.url}/rest/v1/${TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&zone_path=eq.${encodeURIComponent(zone)}` +
    `&status=neq.building`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(env.key, { Prefer: "return=representation" }),
    body: JSON.stringify({
      status: "building",
      embedding_model: embeddingModel,
      last_error: null,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn("[rag/db] claimBuild patch failed", { status: res.status });
    return { claimed: false };
  }
  const rows = (await res.json()) as RagIndexRow[];
  return { claimed: rows.length > 0 };
}

/** Stamp a finished build: status → 'ready', corpus size, last_built_at. */
export async function markReady(
  ownerId: string,
  zonePath: string,
  fields: { docCount: number; tokenCount: number; embeddingModel: string },
): Promise<void> {
  const env = paEnv();
  if (!env) return;
  const zone = normalizeZonePath(zonePath);
  const now = new Date().toISOString();
  const url =
    `${env.url}/rest/v1/${TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}&zone_path=eq.${encodeURIComponent(zone)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(env.key, { Prefer: "return=minimal" }),
    body: JSON.stringify({
      status: "ready",
      doc_count: fields.docCount,
      token_count: fields.tokenCount,
      embedding_model: fields.embeddingModel,
      last_built_at: now,
      last_error: null,
      updated_at: now,
    }),
    cache: "no-store",
  });
  if (!res.ok) console.warn("[rag/db] markReady failed", { status: res.status });
}

/** Record a failed build: status → 'error', last_error. Releases the claim. */
export async function markError(ownerId: string, zonePath: string, error: string): Promise<void> {
  const env = paEnv();
  if (!env) return;
  const zone = normalizeZonePath(zonePath);
  const url =
    `${env.url}/rest/v1/${TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}&zone_path=eq.${encodeURIComponent(zone)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(env.key, { Prefer: "return=minimal" }),
    body: JSON.stringify({
      status: "error",
      last_error: error.slice(0, 500),
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) console.warn("[rag/db] markError failed", { status: res.status });
}
