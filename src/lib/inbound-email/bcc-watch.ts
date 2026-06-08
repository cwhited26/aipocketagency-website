// bcc-watch.ts — data layer for pa_bcc_thread_watch (service-role REST, no SDK).
//
// A watch is created when an owner BCCs <owner>@bcc on an outgoing email. The gmail-sync
// cron reads each owner's open watches, matches new inbox mail against them, and on a hit
// drafts the owner's reply. Watches expire after 30 days.

export type BccWatchStatus = "watching" | "reply-drafted" | "expired" | "purged";

export type BccWatch = {
  id: string;
  owner_id: string;
  gmail_thread_or_msg_id: string;
  original_rfc_message_id: string | null;
  recipient_addr: string;
  original_subject: string;
  expires_at: string;
  status: BccWatchStatus;
  created_at: string;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_bcc_thread_watch";
const WATCH_DAYS = 30;

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

/** The expiry instant for a watch created now (+30 days). */
export function watchExpiry(fromMs: number = Date.now()): string {
  return new Date(fromMs + WATCH_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export async function createBccWatch(params: {
  ownerId: string;
  gmailThreadOrMsgId: string;
  originalRfcMessageId: string | null;
  recipientAddr: string;
  originalSubject: string;
}): Promise<PaResult<BccWatch>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: params.ownerId,
      gmail_thread_or_msg_id: params.gmailThreadOrMsgId,
      original_rfc_message_id: params.originalRfcMessageId,
      recipient_addr: params.recipientAddr,
      original_subject: params.originalSubject.slice(0, 2000),
      expires_at: watchExpiry(),
      status: "watching",
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as BccWatch[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: rows[0] };
}

/** An owner's open ('watching') watches that have not yet expired. */
export async function fetchOpenWatches(ownerId: string): Promise<PaResult<BccWatch[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const nowIso = new Date().toISOString();
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}` +
      `&status=eq.watching` +
      `&expires_at=gt.${encodeURIComponent(nowIso)}` +
      `&select=*`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as BccWatch[] };
}

export async function setWatchStatus(id: string, status: BccWatchStatus): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Expire an owner's overdue watches in one update (cron housekeeping). */
export async function expireOverdueWatches(ownerId: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const nowIso = new Date().toISOString();
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}` +
      `&status=eq.watching` +
      `&expires_at=lt.${encodeURIComponent(nowIso)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "expired" }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Purge the watches tied to a BCC'd email's subject (owner hit "Purge from brain"). */
export async function purgeWatchesBySubject(
  ownerId: string,
  originalSubject: string,
): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}` +
      `&original_subject=eq.${encodeURIComponent(originalSubject.slice(0, 2000))}` +
      `&status=in.(watching,reply-drafted)`,
    {
      method: "PATCH",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "purged" }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
