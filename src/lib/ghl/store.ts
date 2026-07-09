// store.ts — data layer for the four GHL Connector tables (migration 108). Service-role REST
// only, no SDK — the pa-gmail-connections.ts pattern. Two read shapes per connection:
// Public (no ciphertext, safe for the UI) and Full (server-only; the OAuth callback, the
// executor, and the cron read it to mint fresh tokens).

export type GhlConnectionStatus = "active" | "needs_reauth" | "revoked";
export type GhlUserType = "Company" | "Location";
export type GhlSyncState = "synced" | "over_cap" | "archived";

export type GhlConnectionPublic = {
  id: string;
  owner_id: string;
  agency_company_id: string | null;
  agency_location_id: string | null;
  user_type: GhlUserType;
  scopes: string[];
  status: GhlConnectionStatus;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GhlConnectionFull = GhlConnectionPublic & {
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
};

export type GhlClientLocation = {
  id: string;
  owner_id: string;
  connection_id: string;
  ghl_location_id: string;
  name: string;
  timezone: string | null;
  address: string | null;
  sync_state: GhlSyncState;
  last_synced_at: string | null;
};

export type GhlResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const CONNECTIONS = "pa_ghl_connections";
const LOCATIONS = "pa_ghl_client_locations";
const ACTION_LOG = "pa_ghl_action_log";
const WEBHOOK_EVENTS = "pa_ghl_webhook_events";

const PUBLIC_FIELDS =
  "id,owner_id,agency_company_id,agency_location_id,user_type,scopes,status,token_expires_at,created_at,updated_at";
const FULL_FIELDS = `${PUBLIC_FIELDS},access_token_encrypted,refresh_token_encrypted`;
const LOCATION_FIELDS =
  "id,owner_id,connection_id,ghl_location_id,name,timezone,address,sync_state,last_synced_at";

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

// ─── Connection reads ─────────────────────────────────────────────────────────

export async function fetchGhlConnectionPublic(
  ownerId: string,
): Promise<GhlResult<GhlConnectionPublic | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${CONNECTIONS}?owner_id=eq.${encodeURIComponent(ownerId)}&select=${PUBLIC_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as GhlConnectionPublic[];
  return { ok: true, data: rows[0] ?? null };
}

export async function fetchGhlConnectionFull(
  ownerId: string,
): Promise<GhlResult<GhlConnectionFull | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${CONNECTIONS}?owner_id=eq.${encodeURIComponent(ownerId)}&select=${FULL_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as GhlConnectionFull[];
  return { ok: true, data: rows[0] ?? null };
}

/** Every active connection — the /6h location-sync cron's work list. */
export async function fetchActiveGhlConnections(): Promise<GhlResult<GhlConnectionFull[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${CONNECTIONS}?status=eq.active&select=${FULL_FIELDS}`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as GhlConnectionFull[];
  return { ok: true, data: rows };
}

// ─── Connection writes ────────────────────────────────────────────────────────

export type UpsertGhlConnectionData = {
  ownerId: string;
  agencyCompanyId: string | null;
  agencyLocationId: string | null;
  userType: GhlUserType;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  scopes: string[];
  tokenExpiresAt: string;
};

export async function upsertGhlConnection(
  data: UpsertGhlConnectionData,
): Promise<GhlResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(`${env.url}/rest/v1/${CONNECTIONS}?on_conflict=owner_id`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      owner_id: data.ownerId,
      agency_company_id: data.agencyCompanyId,
      agency_location_id: data.agencyLocationId,
      user_type: data.userType,
      access_token_encrypted: data.accessTokenEncrypted,
      refresh_token_encrypted: data.refreshTokenEncrypted,
      scopes: data.scopes,
      token_expires_at: data.tokenExpiresAt,
      status: "active",
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Persist a refreshed token pair (GHL rotates the refresh token on every refresh). */
export async function updateGhlTokens(
  connectionId: string,
  tokens: {
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string;
    tokenExpiresAt: string;
  },
): Promise<GhlResult<void>> {
  return patchConnection(connectionId, {
    access_token_encrypted: tokens.accessTokenEncrypted,
    refresh_token_encrypted: tokens.refreshTokenEncrypted,
    token_expires_at: tokens.tokenExpiresAt,
    status: "active",
    updated_at: new Date().toISOString(),
  });
}

/** Flip a connection whose refresh failed — the UI tells the owner to reconnect. */
export async function markGhlConnectionNeedsReauth(
  connectionId: string,
): Promise<GhlResult<void>> {
  return patchConnection(connectionId, {
    status: "needs_reauth",
    updated_at: new Date().toISOString(),
  });
}

/** Disconnect: revoke status + wipe ciphertext. Row retained for history. */
export async function revokeGhlConnection(ownerId: string): Promise<GhlResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${CONNECTIONS}?owner_id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "revoked",
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

async function patchConnection(
  id: string,
  patch: Record<string, unknown>,
): Promise<GhlResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${CONNECTIONS}?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

// ─── Client locations ─────────────────────────────────────────────────────────

export async function fetchGhlClientLocations(
  ownerId: string,
): Promise<GhlResult<GhlClientLocation[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${LOCATIONS}?owner_id=eq.${encodeURIComponent(ownerId)}&select=${LOCATION_FIELDS}&order=name.asc`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as GhlClientLocation[];
  return { ok: true, data: rows };
}

/** One synced location by GHL id — the executor's multi-tenant ownership check. */
export async function fetchSyncedLocation(
  ownerId: string,
  ghlLocationId: string,
): Promise<GhlResult<GhlClientLocation | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${LOCATIONS}?owner_id=eq.${encodeURIComponent(ownerId)}&ghl_location_id=eq.${encodeURIComponent(ghlLocationId)}&sync_state=eq.synced&select=${LOCATION_FIELDS}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as GhlClientLocation[];
  return { ok: true, data: rows[0] ?? null };
}

/** Resolve which owner a webhook's locationId belongs to (any sync_state). */
export async function fetchOwnerByLocationId(
  ghlLocationId: string,
): Promise<GhlResult<{ owner_id: string } | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(
    `${env.url}/rest/v1/${LOCATIONS}?ghl_location_id=eq.${encodeURIComponent(ghlLocationId)}&select=owner_id&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as { owner_id: string }[];
  return { ok: true, data: rows[0] ?? null };
}

export type UpsertLocationRow = {
  ownerId: string;
  connectionId: string;
  ghlLocationId: string;
  name: string;
  timezone: string | null;
  address: string | null;
  syncState: GhlSyncState;
};

/** Bulk upsert the discovered locations (UNIQUE owner_id+ghl_location_id merges on re-sync). */
export async function upsertGhlClientLocations(
  rows: UpsertLocationRow[],
): Promise<GhlResult<void>> {
  if (rows.length === 0) return { ok: true, data: undefined };
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const now = new Date().toISOString();
  const res = await fetch(
    `${env.url}/rest/v1/${LOCATIONS}?on_conflict=owner_id,ghl_location_id`,
    {
      method: "POST",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(
        rows.map((r) => ({
          owner_id: r.ownerId,
          connection_id: r.connectionId,
          ghl_location_id: r.ghlLocationId,
          name: r.name,
          timezone: r.timezone,
          address: r.address,
          sync_state: r.syncState,
          last_synced_at: now,
        })),
      ),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Archive registry rows whose location left the agency's GHL account. */
export async function archiveMissingLocations(
  ownerId: string,
  presentLocationIds: string[],
): Promise<GhlResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const notIn =
    presentLocationIds.length > 0
      ? `&ghl_location_id=not.in.(${presentLocationIds.map((id) => `"${id.replace(/"/g, "")}"`).join(",")})`
      : "";
  const res = await fetch(
    `${env.url}/rest/v1/${LOCATIONS}?owner_id=eq.${encodeURIComponent(ownerId)}&sync_state=neq.archived${notIn}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ sync_state: "archived" }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

// ─── Action log ───────────────────────────────────────────────────────────────

export type GhlActionLogRow = {
  ownerId: string;
  inboxItemId: string | null;
  action: string;
  ghlLocationId: string;
  endpoint: string;
  payloadHash: string;
  status: "executed" | "failed" | "blocked";
  error: string | null;
  latencyMs: number | null;
};

/** Append one execution-audit row. Best-effort by contract — the caller already has the real
 *  outcome; a ledger hiccup is surfaced as a structured warn, never a thrown error. */
export async function insertGhlActionLog(row: GhlActionLogRow): Promise<void> {
  const env = paEnv();
  if ("error" in env) {
    console.warn("[ghl/store] action log dropped — no service env", { action: row.action });
    return;
  }
  const res = await fetch(`${env.url}/rest/v1/${ACTION_LOG}`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      owner_id: row.ownerId,
      inbox_item_id: row.inboxItemId,
      action: row.action,
      ghl_location_id: row.ghlLocationId,
      endpoint: row.endpoint,
      payload_hash: row.payloadHash,
      status: row.status,
      error: row.error,
      latency_ms: row.latencyMs,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn("[ghl/store] action log insert rejected", {
      action: row.action,
      status: res.status,
      body: (await res.text().catch(() => "")).slice(0, 200),
    });
  }
}

// ─── Webhook events (idempotency ledger) ──────────────────────────────────────

export type GhlWebhookEventRow = {
  webhookId: string;
  ownerId: string | null;
  eventType: string;
  ghlLocationId: string | null;
  payloadHash: string;
  signatureScheme: "ed25519" | "rsa";
};

/**
 * Record a verified delivery. Returns false when the webhook_id already exists (redelivery —
 * the caller skips processing), true when this is the first sighting.
 */
export async function recordGhlWebhookEvent(row: GhlWebhookEventRow): Promise<GhlResult<boolean>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  const res = await fetch(`${env.url}/rest/v1/${WEBHOOK_EVENTS}`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      webhook_id: row.webhookId,
      owner_id: row.ownerId,
      event_type: row.eventType,
      ghl_location_id: row.ghlLocationId,
      payload_hash: row.payloadHash,
      signature_scheme: row.signatureScheme,
    }),
    cache: "no-store",
  });
  if (res.ok) return { ok: true, data: true };
  const body = await res.text().catch(() => "");
  // 23505 / 409 on webhook_id = redelivery of an event we already hold. Not an error.
  if (res.status === 409 || body.includes("23505")) return { ok: true, data: false };
  return { ok: false, status: res.status, error: body };
}

/** Stamp a recorded event as processed once its handler ran. */
export async function markGhlWebhookProcessed(webhookId: string): Promise<void> {
  const env = paEnv();
  if ("error" in env) return;
  const res = await fetch(
    `${env.url}/rest/v1/${WEBHOOK_EVENTS}?webhook_id=eq.${encodeURIComponent(webhookId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ processed_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    console.warn("[ghl/store] webhook processed stamp rejected", {
      webhookId,
      status: res.status,
    });
  }
}
