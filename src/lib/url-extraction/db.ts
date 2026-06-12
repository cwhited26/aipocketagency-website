// db.ts — pa_url_extractions access (migration 078). Direct service-role REST per the repo rule;
// writes only happen from gated API routes / the worker, reads come back owner-scoped.

import type { ScreenshotCapture, UrlExtractionRow } from "./types";

const TABLE = "pa_url_extractions";

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
    ...extra,
  };
}

export type DbResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createExtractionRow(params: {
  ownerId: string;
  sourceUrl: string;
  note: string | null;
}): Promise<DbResult<UrlExtractionRow>> {
  const env = paEnv();
  if (!env) return { ok: false, error: "Supabase service-role env not set." };
  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: headers(env.key, { Prefer: "return=representation" }),
    body: JSON.stringify({
      owner_id: params.ownerId,
      source_url: params.sourceUrl,
      note: params.note,
      status: "running",
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `Could not create the extraction run (${res.status}).` };
  const rows = (await res.json()) as UrlExtractionRow[];
  if (!rows[0]) return { ok: false, error: "Extraction run insert returned no row." };
  return { ok: true, data: rows[0] };
}

export async function updateExtractionRow(
  id: string,
  patch: Partial<{
    status: UrlExtractionRow["status"];
    profile_md: string | null;
    extraction_log_md: string | null;
    screenshots: ScreenshotCapture[] | null;
    dna_record_path: string | null;
    extraction_log_path: string | null;
    error: string | null;
  }>,
): Promise<DbResult<null>> {
  const env = paEnv();
  if (!env) return { ok: false, error: "Supabase service-role env not set." };
  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${id}`, {
    method: "PATCH",
    headers: headers(env.key, { Prefer: "return=minimal" }),
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `Could not update the extraction run (${res.status}).` };
  return { ok: true, data: null };
}

export async function fetchExtractionRow(
  id: string,
): Promise<DbResult<UrlExtractionRow | null>> {
  const env = paEnv();
  if (!env) return { ok: false, error: "Supabase service-role env not set." };
  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${id}&limit=1`, {
    headers: headers(env.key),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `Could not read the extraction run (${res.status}).` };
  const rows = (await res.json()) as UrlExtractionRow[];
  return { ok: true, data: rows[0] ?? null };
}

/** Slim list view — never drags profile_md / screenshots base64 into a list query. */
export type ExtractionListItem = Pick<
  UrlExtractionRow,
  "id" | "source_url" | "status" | "note" | "dna_record_path" | "error" | "created_at"
>;

export async function listExtractions(ownerId: string, limit = 50): Promise<DbResult<ExtractionListItem[]>> {
  const env = paEnv();
  if (!env) return { ok: false, error: "Supabase service-role env not set." };
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?owner_id=eq.${ownerId}` +
      `&select=id,source_url,status,note,dna_record_path,error,created_at` +
      `&order=created_at.desc&limit=${limit}`,
    { headers: headers(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, error: `Could not list extraction runs (${res.status}).` };
  return { ok: true, data: (await res.json()) as ExtractionListItem[] };
}
