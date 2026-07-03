export type PaUser = {
  id: string;
  github_username: string;
  brain_repo: string | null;
  github_token: string | null;
  anthropic_api_key: string | null;
  brain_root_index_json: unknown[] | null;
  brain_indexed_at: string | null;
  // When the owner explicitly hid the Agent-landing setup status bar (null = still showing).
  setup_bar_dismissed_at: string | null;
  // The vertical picked at onboarding (PA-POS-22, migration 099). NULL = skipped or pre-picker;
  // optional because rows read before migration 099 applies don't carry the column.
  vertical?: string | null;
  created_at: string;
  updated_at: string;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

export async function fetchPaUser(userId: string): Promise<PaResult<PaUser | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint = `${env.url}/rest/v1/pocket_agent_users?id=eq.${encodeURIComponent(userId)}&limit=1`;
  const res = await fetch(endpoint, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as PaUser[];
  return { ok: true, data: rows[0] ?? null };
}

export async function initPaUser(user: {
  id: string;
  github_username: string;
}): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint = `${env.url}/rest/v1/pocket_agent_users`;
  const body = {
    id: user.id,
    github_username: user.github_username,
    brain_repo: null,
    github_token: null,
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

export async function upsertPaUser(user: {
  id: string;
  github_username: string;
  brain_repo: string;
  github_token?: string | null;
}): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint = `${env.url}/rest/v1/pocket_agent_users`;
  const body = {
    id: user.id,
    github_username: user.github_username,
    brain_repo: user.brain_repo,
    github_token: user.github_token ?? null,
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

export async function upsertPaUserApiKey(
  userId: string,
  apiKey: string | null,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint = `${env.url}/rest/v1/pocket_agent_users?id=eq.${encodeURIComponent(userId)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ anthropic_api_key: apiKey, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

// Persist (or clear) the owner's dismissal of the Agent-landing setup status bar.
// Pass an ISO timestamp to hide it; pass null to bring it back (Settings → resurface).
export async function setPaUserSetupBarDismissed(
  userId: string,
  dismissedAt: string | null,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint = `${env.url}/rest/v1/pocket_agent_users?id=eq.${encodeURIComponent(userId)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      setup_bar_dismissed_at: dismissedAt,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

export async function patchGithubToken(
  userId: string,
  githubToken: string,
  githubUsername?: string,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint = `${env.url}/rest/v1/pocket_agent_users?id=eq.${encodeURIComponent(userId)}`;
  const patch: Record<string, string> = {
    github_token: githubToken,
    updated_at: new Date().toISOString(),
  };
  if (githubUsername) patch.github_username = githubUsername;

  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

export async function checkActiveSubscription(userId: string): Promise<boolean> {
  const env = paEnv();
  if ("error" in env) return true;

  const endpoint =
    `${env.url}/rest/v1/pocket_agent_subscriptions` +
    `?user_id=eq.${encodeURIComponent(userId)}&status=in.(active,trialing)&limit=1`;
  try {
    const res = await fetch(endpoint, {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    });
    if (!res.ok) return true; // table may not exist yet
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return true;
  }
}

// ─── Brain digest cache ────────────────────────────────────────────────────────

export type CachedDigestRow = {
  brain_digest_json: Record<string, unknown> | null;
  brain_digest_generated_at: string | null;
};

export async function fetchCachedDigest(userId: string): Promise<CachedDigestRow | null> {
  const env = paEnv();
  if ("error" in env) return null;

  try {
    const res = await fetch(
      `${env.url}/rest/v1/pocket_agent_users?id=eq.${encodeURIComponent(userId)}&select=brain_digest_json,brain_digest_generated_at&limit=1`,
      { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as CachedDigestRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function saveDigestCache(
  userId: string,
  digestJson: Record<string, unknown>,
): Promise<void> {
  const env = paEnv();
  if ("error" in env) return;

  try {
    await fetch(
      `${env.url}/rest/v1/pocket_agent_users?id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: env.key,
          Authorization: `Bearer ${env.key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          brain_digest_json: digestJson,
          brain_digest_generated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      },
    );
  } catch {
    // Cache write failure is non-fatal
  }
}
