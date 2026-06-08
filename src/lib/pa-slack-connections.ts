/**
 * Data layer for pa_connections rows with provider='slack' — service-role REST only.
 * Mirrors pa-gmail-connections.ts; the two share the pa_connections table (migration 013,
 * provider CHECK widened to admit 'slack' in migration 023).
 *
 * Token storage model (see lib/connectors/slack/oauth.ts for the lifecycle):
 *   • refresh_token_encrypted — the DURABLE secret, AES-256-GCM via lib/crypto/encrypt.ts.
 *       - Non-rotating install: the long-lived bot token (xoxb-…) lives here; access_token
 *         and access_token_expires_at stay null, and ensureFreshSlackToken decrypts this.
 *       - Rotating install (token rotation enabled on the Slack app): the refresh token
 *         (xoxe-…) lives here; access_token caches the short-lived bot token + expiry,
 *         exactly like Gmail.
 *   • email column is REPURPOSED to store the connected workspace (team) name for display —
 *     pa_connections has no provider-metadata column and the workspace name is the one
 *     cosmetic field the Connections card shows. Documented here so the repurpose is explicit.
 */

export type SlackConnectionStatus = "active" | "revoked" | "error";

export type SlackConnectionPublic = {
  id: string;
  user_id: string;
  provider: "slack";
  /** Workspace (team) name — stored in the shared `email` column (see file header). */
  workspace: string | null;
  scopes: string[] | null;
  status: SlackConnectionStatus;
  /** Installing user's Slack id + workspace id (migration 037) — present once reconnected. */
  slack_user_id: string | null;
  slack_team_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SlackConnectionFull = SlackConnectionPublic & {
  refresh_token_encrypted: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_connections";

const PUBLIC_FIELDS =
  "id,user_id,provider,email,scopes,status,slack_user_id,slack_team_id,created_at,updated_at";
const FULL_FIELDS =
  `${PUBLIC_FIELDS},refresh_token_encrypted,access_token,access_token_expires_at`;

// The PostgREST row shape (email is the raw column; we expose it as `workspace`).
type SlackRow = {
  id: string;
  user_id: string;
  provider: "slack";
  email: string | null;
  scopes: string[] | null;
  status: SlackConnectionStatus;
  slack_user_id?: string | null;
  slack_team_id?: string | null;
  created_at: string;
  updated_at: string;
  refresh_token_encrypted?: string | null;
  access_token?: string | null;
  access_token_expires_at?: string | null;
};

function toPublic(row: SlackRow): SlackConnectionPublic {
  return {
    id: row.id,
    user_id: row.user_id,
    provider: "slack",
    workspace: row.email,
    scopes: row.scopes,
    status: row.status,
    slack_user_id: row.slack_user_id ?? null,
    slack_team_id: row.slack_team_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toFull(row: SlackRow): SlackConnectionFull {
  return {
    ...toPublic(row),
    refresh_token_encrypted: row.refresh_token_encrypted ?? null,
    access_token: row.access_token ?? null,
    access_token_expires_at: row.access_token_expires_at ?? null,
  };
}

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

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function fetchSlackConnectionPublic(
  userId: string,
): Promise<PaResult<SlackConnectionPublic | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.slack&select=${PUBLIC_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as SlackRow[];
  return { ok: true, data: rows[0] ? toPublic(rows[0]) : null };
}

export async function fetchSlackConnectionFull(
  userId: string,
): Promise<PaResult<SlackConnectionFull | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.slack&select=${FULL_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as SlackRow[];
  return { ok: true, data: rows[0] ? toFull(rows[0]) : null };
}

/**
 * Resolve the owner behind an inbound Slack event by the author's Slack user id (migration 037).
 * Returns the FULL connection (the caller needs both `user_id` to route the message into PA and
 * the token to post the reply). When `teamId` is given it's added as an extra filter so a user id
 * that collides across workspaces resolves to the right install. Only `status='active'` rows match
 * — a revoked/errored connection should not silently answer DMs.
 */
export async function fetchSlackConnectionBySlackUserId(
  slackUserId: string,
  teamId: string | null,
): Promise<PaResult<SlackConnectionFull | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const teamFilter = teamId
    ? `&slack_team_id=eq.${encodeURIComponent(teamId)}`
    : "";
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?slack_user_id=eq.${encodeURIComponent(slackUserId)}` +
      `&provider=eq.slack&status=eq.active${teamFilter}&select=${FULL_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as SlackRow[];
  return { ok: true, data: rows[0] ? toFull(rows[0]) : null };
}

// ─── Writes (service-role) ────────────────────────────────────────────────────

export type UpsertSlackConnectionData = {
  userId: string;
  workspace: string | null;
  refreshTokenEncrypted: string;
  // Present only for token-rotation installs; null for long-lived bot tokens.
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  scopes: string[];
  // Slack identity (migration 037) — drives inbound DM owner resolution. Null if oauth.v2.access
  // didn't return them (shouldn't happen for a bot install, but stays nullable to fail soft).
  slackUserId: string | null;
  slackTeamId: string | null;
};

export async function upsertSlackConnection(
  data: UpsertSlackConnectionData,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    user_id: data.userId,
    provider: "slack",
    email: data.workspace,
    refresh_token_encrypted: data.refreshTokenEncrypted,
    access_token: data.accessToken,
    access_token_expires_at: data.accessTokenExpiresAt,
    scopes: data.scopes,
    slack_user_id: data.slackUserId,
    slack_team_id: data.slackTeamId,
    status: "active",
    updated_at: now,
  };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=user_id,provider`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Cache a freshly rotated access token + expiry on the row (rotation installs only). */
export async function updateSlackAccessToken(
  id: string,
  accessToken: string,
  accessTokenExpiresAt: string,
): Promise<PaResult<void>> {
  return patchById(id, {
    access_token: accessToken,
    access_token_expires_at: accessTokenExpiresAt,
    status: "active",
    updated_at: new Date().toISOString(),
  });
}

/** Persist a rotated refresh token (Slack rotation issues a new one on every refresh). */
export async function updateSlackRefreshToken(
  id: string,
  refreshTokenEncrypted: string,
): Promise<PaResult<void>> {
  return patchById(id, {
    refresh_token_encrypted: refreshTokenEncrypted,
    updated_at: new Date().toISOString(),
  });
}

/** Mark a connection broken so write actions stop firing against a dead token. */
export async function markSlackConnectionError(id: string): Promise<PaResult<void>> {
  return patchById(id, { status: "error", updated_at: new Date().toISOString() });
}

/** Soft-delete on disconnect: revoke status + wipe tokens. Row retained for history. */
export async function revokeSlackConnection(userId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(userId)}&provider=eq.slack`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "revoked",
        refresh_token_encrypted: null,
        access_token: null,
        access_token_expires_at: null,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

async function patchById(id: string, patch: Record<string, unknown>): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
