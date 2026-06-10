// lib/channels/store.ts — the persistence layer for the Channels Gateway: pa_channel_connections
// (one row per owner+channel) and pa_channel_messages (append-only forensics). Service-role REST
// only, no SDK — matching pa-slack-connections.ts / pa-inbox-items.ts. The encrypted bot token is
// stored as an AES-256-GCM envelope (lib/crypto/encrypt.ts) and decrypted only here, at read time,
// for the webhook + outbound path. RLS lets an owner SELECT their own rows; every write goes
// through the service-role key, and the calling routes gate ownership before mutating.

import { encrypt, decrypt, DecryptionError } from "@/lib/crypto/encrypt";
import { channelLog } from "./log";
import type { ChannelConnection, ChannelSlug } from "./types";
import { isChannelSlug } from "./types";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const CONNECTIONS_TABLE = "pa_channel_connections";
const MESSAGES_TABLE = "pa_channel_messages";

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

// ── Row shape (as PostgREST returns it) ───────────────────────────────────────────────────────

type ChannelConnectionRow = {
  id: string;
  owner_id: string;
  channel_slug: string;
  external_id: string;
  persona_id: string | null;
  auth_token_encrypted: string | null;
  config: Record<string, unknown> | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

// The public view the settings surface reads — never carries the token.
export type ChannelConnectionPublic = {
  id: string;
  channelSlug: ChannelSlug;
  externalId: string;
  personaId: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
};

function toPublic(row: ChannelConnectionRow): ChannelConnectionPublic | null {
  if (!isChannelSlug(row.channel_slug)) return null;
  return {
    id: row.id,
    channelSlug: row.channel_slug,
    externalId: row.external_id,
    personaId: row.persona_id,
    config: row.config ?? {},
    enabled: row.enabled,
    createdAt: row.created_at,
  };
}

// Map a row to the gateway's ChannelConnection, decrypting the token. A token that won't decrypt
// (rotated key / tamper) surfaces as a null token rather than throwing — the caller treats a null
// token as "needs reconnect".
function toConnection(row: ChannelConnectionRow): ChannelConnection | null {
  if (!isChannelSlug(row.channel_slug)) return null;
  let authToken: string | null = null;
  if (row.auth_token_encrypted) {
    try {
      authToken = decrypt(row.auth_token_encrypted);
    } catch (err) {
      if (err instanceof DecryptionError) {
        channelLog.error("channel token decrypt failed", {
          connectionId: row.id,
          channelSlug: row.channel_slug,
        });
      } else {
        throw err;
      }
    }
  }
  return {
    id: row.id,
    ownerId: row.owner_id,
    channelSlug: row.channel_slug,
    externalId: row.external_id,
    personaId: row.persona_id,
    authToken,
    config: row.config ?? {},
    enabled: row.enabled,
  };
}

// ── Connections ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert the owner's connection for a channel, keyed on (channel_slug, external_id). The bot token
 * is encrypted here before it touches the DB. Re-pairing the same workspace updates the row in
 * place (config + token refreshed) rather than creating a duplicate.
 */
export async function upsertChannelConnection(params: {
  ownerId: string;
  channelSlug: ChannelSlug;
  externalId: string;
  authToken: string;
  config: Record<string, unknown>;
  personaId?: string | null;
}): Promise<PaResult<ChannelConnectionPublic>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const body = {
    owner_id: params.ownerId,
    channel_slug: params.channelSlug,
    external_id: params.externalId,
    auth_token_encrypted: encrypt(params.authToken),
    config: params.config,
    ...(params.personaId !== undefined ? { persona_id: params.personaId } : {}),
    enabled: true,
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(
    `${env.url}/rest/v1/${CONNECTIONS_TABLE}?on_conflict=channel_slug,external_id`,
    {
      method: "POST",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ChannelConnectionRow[];
  const pub = rows[0] ? toPublic(rows[0]) : null;
  if (!pub) return { ok: false, status: 500, error: "No connection row returned after upsert." };
  return { ok: true, data: pub };
}

/**
 * Resolve an owner from a channel's external identity — the inbound webhook's first lookup. Returns
 * the full ChannelConnection (token decrypted) so the gateway can both dispatch and reply.
 */
export async function fetchChannelConnectionByExternalId(
  channelSlug: ChannelSlug,
  externalId: string,
): Promise<PaResult<ChannelConnection | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/${CONNECTIONS_TABLE}` +
    `?channel_slug=eq.${encodeURIComponent(channelSlug)}` +
    `&external_id=eq.${encodeURIComponent(externalId)}` +
    `&limit=1`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ChannelConnectionRow[];
  if (!rows[0]) return { ok: true, data: null };
  return { ok: true, data: toConnection(rows[0]) };
}

/** The owner's connection for a channel, as the settings surface reads it (no token). */
export async function fetchChannelConnectionForOwner(
  ownerId: string,
  channelSlug: ChannelSlug,
): Promise<PaResult<ChannelConnectionPublic | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/${CONNECTIONS_TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&channel_slug=eq.${encodeURIComponent(channelSlug)}` +
    `&limit=1`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ChannelConnectionRow[];
  if (!rows[0]) return { ok: true, data: null };
  return { ok: true, data: toPublic(rows[0]) };
}

/** The full connection (token decrypted) for an owner+channel — used by the "send test" route. */
export async function fetchOwnerChannelConnectionFull(
  ownerId: string,
  channelSlug: ChannelSlug,
): Promise<PaResult<ChannelConnection | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/${CONNECTIONS_TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&channel_slug=eq.${encodeURIComponent(channelSlug)}` +
    `&limit=1`;
  const res = await fetch(endpoint, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ChannelConnectionRow[];
  if (!rows[0]) return { ok: true, data: null };
  return { ok: true, data: toConnection(rows[0]) };
}

/** Set the Persona that answers on a channel (PA-CHAN-8). Ownership-scoped. */
export async function setChannelConnectionPersona(
  ownerId: string,
  channelSlug: ChannelSlug,
  personaId: string | null,
): Promise<PaResult<true>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/${CONNECTIONS_TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&channel_slug=eq.${encodeURIComponent(channelSlug)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
    body: JSON.stringify({ persona_id: personaId, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: true };
}

/**
 * Flag a connection as needing reconnect after a hard auth failure on send (token revoked). Sets
 * enabled=false by row id; the settings card then prompts a reconnect. Best-effort.
 */
export async function disableChannelConnectionById(connectionId: string): Promise<void> {
  const env = paEnv();
  if ("error" in env) return;
  const endpoint =
    `${env.url}/rest/v1/${CONNECTIONS_TABLE}?id=eq.${encodeURIComponent(connectionId)}`;
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) {
    channelLog.warn("could not flag connection for reconnect", {
      connectionId,
      status: res.status,
    });
  }
}

/** Disconnect the channel — delete the owner's connection row (messages cascade). */
export async function deleteChannelConnection(
  ownerId: string,
  channelSlug: ChannelSlug,
): Promise<PaResult<true>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const endpoint =
    `${env.url}/rest/v1/${CONNECTIONS_TABLE}` +
    `?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&channel_slug=eq.${encodeURIComponent(channelSlug)}`;
  const res = await fetch(endpoint, {
    method: "DELETE",
    headers: authHeaders(env.key),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: true };
}

// ── Messages (append-only forensics) ──────────────────────────────────────────────────────────

/**
 * Append one inbound/outbound message to the forensics log. Best-effort: a failed write is logged
 * and swallowed so a forensics hiccup never drops the owner's reply. Returns the new row id (for
 * linking the cost event), or null on failure.
 */
export async function recordChannelMessage(params: {
  ownerId: string;
  connectionId: string;
  direction: "inbound" | "outbound";
  body: string;
  threadId: string | null;
  attachments?: unknown;
  rawPayload?: unknown;
  costEventId?: string | null;
}): Promise<string | null> {
  const env = paEnv();
  if ("error" in env) {
    channelLog.warn("channel message not recorded — service-role env unset", {
      direction: params.direction,
    });
    return null;
  }

  const res = await fetch(`${env.url}/rest/v1/${MESSAGES_TABLE}`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      owner_id: params.ownerId,
      connection_id: params.connectionId,
      direction: params.direction,
      body: params.body,
      thread_id: params.threadId,
      attachments: params.attachments ?? null,
      raw_payload: params.rawPayload ?? null,
      cost_event_id: params.costEventId ?? null,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    channelLog.error("channel message write failed", {
      direction: params.direction,
      status: res.status,
    });
    return null;
  }
  const rows = (await res.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}
