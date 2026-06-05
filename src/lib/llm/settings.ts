// settings.ts — data-access for pa_llm_provider_settings (migration 017). Uses the PA
// Supabase project over PostgREST with the service-role key, mirroring lib/personas/db.
// Reads + writes go through here; RLS exposes only the owner's own SELECT. Functions
// throw LlmSettingsError on a hard failure (never a silent catch) and return null for
// not-found.

import type { LlmProvider } from "./types";

export class LlmSettingsError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "LlmSettingsError";
    this.status = status;
  }
}

export type LlmProviderSettingsRow = {
  user_id: string;
  provider: LlmProvider;
  encrypted_api_key: string | null;
  model_id: string | null;
  custom_endpoint_url: string | null;
  last_error_at: string | null;
  last_error_code: string | null;
  updated_at: string;
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
  if (!url || !key) throw new LlmSettingsError("Supabase env vars not set", 500);
  return { url: url.replace(/\/$/, ""), key };
}

type RestInit = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
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
    throw new LlmSettingsError(
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

export async function loadProviderSettings(
  userId: string,
): Promise<LlmProviderSettingsRow | null> {
  const rows = await rest<LlmProviderSettingsRow[]>(
    `pa_llm_provider_settings?user_id=eq.${enc(userId)}&limit=1`,
  );
  return rows[0] ?? null;
}

export async function upsertProviderSettings(row: {
  user_id: string;
  provider: LlmProvider;
  encrypted_api_key: string | null;
  model_id: string | null;
  custom_endpoint_url: string | null;
}): Promise<LlmProviderSettingsRow> {
  const rows = await rest<LlmProviderSettingsRow[]>(
    "pa_llm_provider_settings?on_conflict=user_id",
    {
      method: "POST",
      // on_conflict + merge-duplicates so a re-save updates the existing PK row.
      prefer: "resolution=merge-duplicates,return=representation",
      body: {
        ...row,
        // A fresh save clears any prior error state.
        last_error_at: null,
        last_error_code: null,
        updated_at: new Date().toISOString(),
      },
    },
  );
  if (!rows[0]) throw new LlmSettingsError("Provider settings upsert returned no row");
  return rows[0];
}

/** Marks the BYO provider as having failed (e.g. a 401) so the UI can surface a banner. */
export async function markProviderError(userId: string, code: string): Promise<void> {
  await rest<void>(`pa_llm_provider_settings?user_id=eq.${enc(userId)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { last_error_at: new Date().toISOString(), last_error_code: code },
  });
}
