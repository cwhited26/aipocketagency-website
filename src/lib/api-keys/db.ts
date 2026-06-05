// db.ts — data-access for pa_api_keys + pa_api_requests_log (migration 017). PA Supabase
// project over PostgREST with the service-role key, mirroring lib/personas/db. RLS
// exposes only owner SELECTs; all writes go through here. Functions throw ApiKeyDbError
// on a hard failure (never a silent catch) and return null for not-found.

export class ApiKeyDbError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiKeyDbError";
    this.status = status;
  }
}

export type ApiKeyRow = {
  id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

function env(): { url: string; key: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new ApiKeyDbError("Supabase env vars not set", 500);
  return { url: url.replace(/\/$/, ""), key };
}

type RestInit = {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "HEAD";
  prefer?: string;
  body?: unknown;
};

async function rest<T>(pathAndQuery: string, init: RestInit = {}): Promise<T> {
  const { url, key } = env();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.prefer) headers.Prefer = init.prefer;

  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiKeyDbError(
      `Supabase ${init.method ?? "GET"} ${pathAndQuery.split("?")[0]} failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

const enc = encodeURIComponent;

// ── pa_api_keys ─────────────────────────────────────────────────────────────────────

export async function insertApiKey(row: {
  user_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  scopes: string[];
}): Promise<ApiKeyRow> {
  const rows = await rest<ApiKeyRow[]>("pa_api_keys", {
    method: "POST",
    prefer: "return=representation",
    body: row,
  });
  if (!rows[0]) throw new ApiKeyDbError("API key insert returned no row");
  return rows[0];
}

export async function listApiKeysForUser(userId: string): Promise<ApiKeyRow[]> {
  return rest<ApiKeyRow[]>(
    `pa_api_keys?user_id=eq.${enc(userId)}&order=created_at.desc`,
  );
}

export async function fetchApiKeyByHash(keyHash: string): Promise<ApiKeyRow | null> {
  const rows = await rest<ApiKeyRow[]>(`pa_api_keys?key_hash=eq.${enc(keyHash)}&limit=1`);
  return rows[0] ?? null;
}

/** Soft-deletes a key (revoked_at = now) for this owner. Returns true when a row matched. */
export async function revokeApiKey(id: string, userId: string): Promise<boolean> {
  const rows = await rest<ApiKeyRow[]>(
    `pa_api_keys?id=eq.${enc(id)}&user_id=eq.${enc(userId)}&revoked_at=is.null`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: { revoked_at: new Date().toISOString() },
    },
  );
  return rows.length > 0;
}

export async function touchLastUsed(id: string): Promise<void> {
  await rest<void>(`pa_api_keys?id=eq.${enc(id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { last_used_at: new Date().toISOString() },
  });
}

// ── pa_api_requests_log ──────────────────────────────────────────────────────────────

export async function logApiRequest(row: {
  api_key_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  tokens_used: number;
}): Promise<void> {
  await rest<void>("pa_api_requests_log", {
    method: "POST",
    prefer: "return=minimal",
    body: row,
  });
}

/**
 * Counts log rows for a key since an ISO timestamp. Uses a HEAD request with
 * `Prefer: count=exact` so we read the count from the Content-Range header instead of
 * materializing rows — cheap even at the day-window scale.
 */
export async function countRequestsSince(
  apiKeyId: string,
  sinceIso: string,
): Promise<number> {
  const { url, key } = env();
  const res = await fetch(
    `${url}/rest/v1/pa_api_requests_log?api_key_id=eq.${enc(apiKeyId)}&created_at=gte.${enc(sinceIso)}&select=id`,
    {
      method: "HEAD",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
      cache: "no-store",
    },
  );
  if (!res.ok && res.status !== 206) {
    const text = await res.text().catch(() => "");
    throw new ApiKeyDbError(`Request-log count failed (${res.status}): ${text.slice(0, 160)}`, res.status);
  }
  // Content-Range looks like "0-0/123" (or "*/0"); the total is after the slash.
  const range = res.headers.get("content-range");
  const total = range?.split("/")[1];
  const n = total ? Number(total) : 0;
  return Number.isFinite(n) ? n : 0;
}
