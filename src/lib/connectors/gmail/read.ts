// lib/connectors/gmail/read.ts — inline (un-gated) Gmail READ actions for the chat tool loop.
//
// Reads never touch the Approval Inbox: the chat-send route calls these directly and streams the
// result back into the conversation. Token lifecycle + Zod-validated REST live in lib/gmail.ts;
// this module resolves the owner's Gmail connection, gets a fresh access token, lists message
// refs, and hydrates each with its From/Subject/snippet metadata for a compact, model-ready view.
//
// Mirrors the connector result contract used elsewhere ({ ok, data } | { ok:false, status, error,
// reauth }) so the dispatcher can surface a reconnect path on a dead grant.

import {
  fetchGmailConnectionFull,
  markGmailConnectionError,
} from "@/lib/pa-gmail-connections";
import {
  ensureFreshAccessToken,
  getMessageMeta,
  listRecentInboxMessages,
  searchMessages,
} from "@/lib/gmail";

// Cap on metadata hydration: each message ref costs one messages.get round-trip, so bound it.
const MAX_HYDRATE = 10;

export type GmailReadMessage = {
  from: string;
  subject: string;
  snippet: string;
  date: string | null;
};

export type GmailReadResult =
  | { ok: true; messages: GmailReadMessage[] }
  | { ok: false; status: number; error: string; reauth: boolean };

export type GmailAccess =
  | { ok: true; token: string; email: string | null; scopes: string[] }
  | { ok: false; status: number; error: string; reauth: boolean };

/**
 * Resolve a usable Gmail access token for the owner, plus the connected address and
 * granted scopes. Refreshes the cached token when stale and self-heals a connection
 * flagged status='error' (a successful refresh flips it back to active inside
 * ensureFreshAccessToken). Shared by every inline Gmail tool — the reads AND the inline
 * draft action — so the reconnect path is identical everywhere.
 */
export async function resolveGmailAccess(userId: string): Promise<GmailAccess> {
  const conn = await fetchGmailConnectionFull(userId);
  if (!conn.ok) return { ok: false, status: conn.status, error: conn.error, reauth: false };
  if (!conn.data || conn.data.status === "revoked") {
    return {
      ok: false,
      status: 409,
      error: "Connect Gmail in Settings → Connections before I can use it.",
      reauth: true,
    };
  }

  const token = await ensureFreshAccessToken(conn.data);
  if (!token.ok) {
    if (token.authError) await markGmailConnectionError(conn.data.id);
    return {
      ok: false,
      status: token.status,
      error: "Gmail authorization expired — reconnect Gmail in Settings → Connections.",
      reauth: true,
    };
  }
  return { ok: true, token: token.data, email: conn.data.email, scopes: conn.data.scopes ?? [] };
}

function epochToIso(internalDate: string | null): string | null {
  if (!internalDate) return null;
  const ms = Number(internalDate);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

async function hydrate(
  token: string,
  refs: { id: string }[],
): Promise<GmailReadMessage[]> {
  const sliced = refs.slice(0, MAX_HYDRATE);
  const metas = await Promise.all(sliced.map((r) => getMessageMeta(token, r.id)));
  const out: GmailReadMessage[] = [];
  for (const m of metas) {
    if (!m.ok) continue;
    out.push({
      from: m.data.from,
      subject: m.data.subject,
      snippet: m.data.snippet,
      date: epochToIso(m.data.internalDate),
    });
  }
  return out;
}

/** Most-recent inbox messages (default 5), newest first. */
export async function gmailListRecent(userId: string, limit: number): Promise<GmailReadResult> {
  const resolved = await resolveGmailAccess(userId);
  if (!resolved.ok) return resolved;

  const bounded = Math.min(Math.max(limit, 1), MAX_HYDRATE);
  const refs = await listRecentInboxMessages(resolved.token, bounded);
  if (!refs.ok) {
    return { ok: false, status: refs.status, error: refs.error, reauth: refs.authError };
  }
  return { ok: true, messages: await hydrate(resolved.token, refs.data) };
}

/** Messages matching a Gmail search query (e.g. "from:patrick is:unread"). */
export async function gmailSearch(
  userId: string,
  query: string,
  limit: number,
): Promise<GmailReadResult> {
  const resolved = await resolveGmailAccess(userId);
  if (!resolved.ok) return resolved;

  const bounded = Math.min(Math.max(limit, 1), MAX_HYDRATE);
  const refs = await searchMessages(resolved.token, query, bounded);
  if (!refs.ok) {
    return { ok: false, status: refs.status, error: refs.error, reauth: refs.authError };
  }
  return { ok: true, messages: await hydrate(resolved.token, refs.data) };
}
