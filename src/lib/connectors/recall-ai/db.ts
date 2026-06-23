// connectors/recall-ai/db.ts — data layer for the Meeting Persona tables (migration 082).
//
// Service-role REST, no SDK — matching lib/connectors/system/log.ts. paEnv/authHeaders are
// intentionally re-declared per data file (the repo's convention) so this module is self-contained.
// All writes go through the service role: the API routes authenticate the owner first (createClient
// getUser), then call these helpers with the resolved owner id; the webhook resolves ownership by
// recall_bot_id before mutating a session.

export type DbResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const CONNECTIONS = "pa_meeting_persona_connections";
const SESSIONS = "pa_meeting_persona_sessions";
const WEBHOOK_EVENTS = "pa_meeting_persona_webhook_events";

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

function isUniqueViolation(status: number, body: string): boolean {
  return status === 409 || body.includes("23505") || body.includes("duplicate key");
}

// ── Connection ───────────────────────────────────────────────────────────────────────────────────

export type RecallConnectionPublic = {
  connected: boolean;
  verifiedAt: string | null;
};

/** Upsert the owner's encrypted Recall API key, stamping last_verified_at = now(). */
export async function upsertRecallConnection(input: {
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
export async function fetchRecallConnectionPublic(
  ownerId: string,
): Promise<DbResult<RecallConnectionPublic>> {
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

/** Full connection (with the encrypted key) for the executor to decrypt at call time. */
export async function fetchRecallConnectionFull(
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

/** Remove the owner's Recall connection. */
export async function deleteRecallConnection(ownerId: string): Promise<DbResult<undefined>> {
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

// ── Sessions ──────────────────────────────────────────────────────────────────────────────────────

export type MeetingSessionRow = {
  id: string;
  owner_id: string;
  recall_bot_id: string;
  status: string;
  recording_url: string | null;
  transcript_available: boolean;
};

// Fuller session shape needed by the transcript brain-write (MP-CORE-2): meeting metadata for the
// markdown frontmatter + path.
export type MeetingSessionDetail = {
  id: string;
  owner_id: string;
  recall_bot_id: string;
  meeting_url: string;
  meeting_provider: string | null;
  meeting_start_at: string | null;
  meeting_end_at: string | null;
  created_at: string;
};

/** Resolve a session by its primary id (used by the transcription orchestrator + brain-write). */
export async function fetchMeetingSessionById(
  sessionId: string,
): Promise<DbResult<MeetingSessionDetail | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(
      `${env.url}/rest/v1/${SESSIONS}?id=eq.${encodeURIComponent(sessionId)}` +
        `&select=id,owner_id,recall_bot_id,meeting_url,meeting_provider,meeting_start_at,meeting_end_at,created_at`,
      { headers: { ...authHeaders(env.key), Accept: "application/json" }, cache: "no-store" },
    );
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as MeetingSessionDetail[];
  return { ok: true, data: rows[0] ?? null };
}

/** Insert a session row the moment a bot is spawned. Returns the new row id. */
export async function insertMeetingSession(input: {
  ownerId: string;
  recallBotId: string;
  meetingUrl: string;
  meetingProvider: string | null;
  status: string;
  botMetadata: Record<string, unknown>;
}): Promise<DbResult<{ id: string }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${SESSIONS}`, {
      method: "POST",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        owner_id: input.ownerId,
        recall_bot_id: input.recallBotId,
        meeting_url: input.meetingUrl,
        meeting_provider: input.meetingProvider,
        status: input.status,
        bot_metadata: input.botMetadata,
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as Array<{ id: string }>;
  if (rows.length === 0) return { ok: false, status: 502, error: "insert returned no row" };
  return { ok: true, data: { id: rows[0].id } };
}

/** Resolve a session by its Recall bot id (the webhook's resolve key). */
export async function fetchMeetingSessionByBotId(
  recallBotId: string,
): Promise<DbResult<MeetingSessionRow | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(
      `${env.url}/rest/v1/${SESSIONS}?recall_bot_id=eq.${encodeURIComponent(recallBotId)}` +
        `&select=id,owner_id,recall_bot_id,status,recording_url,transcript_available`,
      { headers: { ...authHeaders(env.key), Accept: "application/json" }, cache: "no-store" },
    );
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as MeetingSessionRow[];
  return { ok: true, data: rows[0] ?? null };
}

/** Patch a session by Recall bot id. updated_at is maintained by the set_updated_at trigger. */
export async function updateMeetingSessionByBotId(
  recallBotId: string,
  fields: Partial<{
    status: string;
    recording_url: string;
    transcript_available: boolean;
    meeting_end_at: string;
  }>,
): Promise<DbResult<undefined>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };
  if (Object.keys(fields).length === 0) return { ok: true, data: undefined };

  let res: Response;
  try {
    res = await fetch(
      `${env.url}/rest/v1/${SESSIONS}?recall_bot_id=eq.${encodeURIComponent(recallBotId)}`,
      {
        method: "PATCH",
        headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(fields),
        cache: "no-store",
      },
    );
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

// ── Webhook events (append-only audit + idempotency claim) ───────────────────────────────────────

/**
 * Record a webhook delivery. The UNIQUE(event_id) constraint makes this the idempotency claim: the
 * first delivery inserts and returns firstDelivery=true; a re-delivery hits 23505 and returns
 * firstDelivery=false so the route skips reprocessing. Mirrors claimSystemEmail (system/log.ts).
 */
export async function recordWebhookEvent(input: {
  eventId: string;
  recallBotId: string | null;
  eventType: string;
  payload: unknown;
  signatureVerified: boolean;
}): Promise<DbResult<{ firstDelivery: boolean }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${WEBHOOK_EVENTS}`, {
      method: "POST",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_id: input.eventId,
        recall_bot_id: input.recallBotId,
        event_type: input.eventType,
        payload: input.payload,
        signature_verified: input.signatureVerified,
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (res.ok) return { ok: true, data: { firstDelivery: true } };
  const body = await res.text();
  if (isUniqueViolation(res.status, body)) return { ok: true, data: { firstDelivery: false } };
  return { ok: false, status: res.status, error: body };
}
