// log.ts — data layer for pa_inbound_email_log (service-role REST, no SDK). Backs the
// privacy-review page: every email that lands on either address is logged here, and the
// per-entry "Purge from brain" button reads the brain_path off the row before hard-deleting.

import type { AddressKind } from "./parse";

export type InboundLogStatus = "received" | "reply-sent" | "reply-drafted" | "purged";

export type InboundLogEntry = {
  id: string;
  owner_id: string;
  address_kind: AddressKind;
  from_addr: string;
  to_addr: string;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  brain_path: string | null;
  status: InboundLogStatus;
  created_at: string;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_inbound_email_log";

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

export async function logInboundEmail(params: {
  ownerId: string;
  addressKind: AddressKind;
  fromAddr: string;
  toAddr: string;
  subject: string;
  bodyText: string;
  brainPath: string | null;
  status: InboundLogStatus;
}): Promise<PaResult<InboundLogEntry>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: params.ownerId,
      address_kind: params.addressKind,
      from_addr: params.fromAddr,
      to_addr: params.toAddr,
      // Bound the stored body so the log table never holds a multi-MB email.
      subject: params.subject.slice(0, 2000),
      body_text: params.bodyText.slice(0, 20_000),
      brain_path: params.brainPath,
      status: params.status,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as InboundLogEntry[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after insert." };
  return { ok: true, data: rows[0] };
}

/** The most recent log entries for an owner, optionally filtered to one address kind. */
export async function listInboundLog(
  ownerId: string,
  opts: { kind?: AddressKind; limit?: number } = {},
): Promise<PaResult<InboundLogEntry[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let url =
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}` +
    `&order=received_at.desc&limit=${opts.limit ?? 30}`;
  if (opts.kind) url += `&address_kind=eq.${encodeURIComponent(opts.kind)}`;

  const res = await fetch(url, { headers: authHeaders(env.key), cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as InboundLogEntry[] };
}

/** Fetch a single entry (ownership verified by the caller before mutating). */
export async function fetchInboundLogById(id: string): Promise<PaResult<InboundLogEntry | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&limit=1`, {
    headers: authHeaders(env.key),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as InboundLogEntry[];
  return { ok: true, data: rows[0] ?? null };
}

/** Mark an entry purged (the brain capture was hard-deleted). */
export async function markInboundLogPurged(id: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "purged", brain_path: null }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
