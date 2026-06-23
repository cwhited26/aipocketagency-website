// connectors/deepgram/db.ts — data layer for pa_deepgram_connections (migration 083).
//
// Service-role REST, no SDK — mirrors lib/connectors/recall-ai/db.ts. paEnv/authHeaders are
// re-declared per data file (the repo's convention). The API routes authenticate the owner first,
// then call these with the resolved owner id.

export type DbResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const CONNECTIONS = "pa_deepgram_connections";

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

export type DeepgramConnectionPublic = {
  connected: boolean;
  verifiedAt: string | null;
};

/** Upsert the owner's encrypted Deepgram key, stamping last_verified_at = now(). */
export async function upsertDeepgramConnection(input: {
  ownerId: string;
  apiKeyEncrypted: string;
}): Promise<DbResult<{ verifiedAt: string }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const verifiedAt = new Date().toISOString();
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${CONNECTIONS}?on_conflict=owner_id`, {
      method: "POST",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        owner_id: input.ownerId,
        api_key_encrypted: input.apiKeyEncrypted,
        last_verified_at: verifiedAt,
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: { verifiedAt } };
}

/** Owner-facing connection state — never returns the encrypted key. */
export async function fetchDeepgramConnectionPublic(
  ownerId: string,
): Promise<DbResult<DeepgramConnectionPublic>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(
      `${env.url}/rest/v1/${CONNECTIONS}?owner_id=eq.${encodeURIComponent(ownerId)}&select=last_verified_at`,
      { headers: { ...authHeaders(env.key), Accept: "application/json" }, cache: "no-store" },
    );
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Array<{ last_verified_at: string | null }>;
  if (rows.length === 0) return { ok: true, data: { connected: false, verifiedAt: null } };
  return { ok: true, data: { connected: true, verifiedAt: rows[0].last_verified_at } };
}

/** Full connection (with the encrypted key) for the orchestrator to decrypt at call time. */
export async function fetchDeepgramConnectionFull(
  ownerId: string,
): Promise<DbResult<{ apiKeyEncrypted: string } | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(
      `${env.url}/rest/v1/${CONNECTIONS}?owner_id=eq.${encodeURIComponent(ownerId)}&select=api_key_encrypted`,
      { headers: { ...authHeaders(env.key), Accept: "application/json" }, cache: "no-store" },
    );
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Array<{ api_key_encrypted: string }>;
  if (rows.length === 0) return { ok: true, data: null };
  return { ok: true, data: { apiKeyEncrypted: rows[0].api_key_encrypted } };
}

/** Remove the owner's Deepgram connection. */
export async function deleteDeepgramConnection(ownerId: string): Promise<DbResult<undefined>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${CONNECTIONS}?owner_id=eq.${encodeURIComponent(ownerId)}`, {
      method: "DELETE",
      headers: { ...authHeaders(env.key), Prefer: "return=minimal" },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
