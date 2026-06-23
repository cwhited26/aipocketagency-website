// log.ts — data layer for pa_pocket_capture_email_inbound_log (service-role REST, no SDK).
//
// This table is both the audit trail (one row per inbound delivery, matched or not) and the
// idempotency ledger. The webhook CLAIMS a delivery by inserting a row keyed on dedup_key
// (UNIQUE): a duplicate Resend/Svix redelivery collides and is reported as a duplicate, so the
// brain write only ever happens once. After the capture is written the row flips processed=true;
// a matched delivery that can't process (e.g. no brain connected) records error_text instead.

import { paEnv, authHeaders } from "./supabase";

const TABLE = "pa_pocket_capture_email_inbound_log";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export type ClaimResult =
  | { ok: true; duplicate: false; id: string }
  | { ok: true; duplicate: true }
  | { ok: false; status: number; error: string };

/**
 * Claim an inbound delivery by inserting its audit row. On a dedup_key UNIQUE collision (a
 * duplicate delivery) returns `{ duplicate: true }` and writes nothing new — the caller should
 * acknowledge with 200 and skip processing.
 */
export async function claimInboundDelivery(params: {
  ownerId: string | null;
  fromEmail: string;
  subject: string | null;
  dedupKey: string;
  processed?: boolean;
  errorText?: string | null;
}): Promise<ClaimResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      owner_id: params.ownerId,
      from_email: params.fromEmail.slice(0, 320),
      subject: params.subject ? params.subject.slice(0, 2000) : null,
      dedup_key: params.dedupKey,
      processed: params.processed ?? false,
      error_text: params.errorText ?? null,
    }),
    cache: "no-store",
  });

  if (res.ok) {
    const rows = (await res.json()) as { id: string }[];
    if (!rows[0]) return { ok: false, status: 500, error: "No row returned after claim insert." };
    return { ok: true, duplicate: false, id: rows[0].id };
  }

  const body = await res.text();
  // 23505 = duplicate key on dedup_key → this delivery was already claimed. Idempotent no-op.
  if (res.status === 409 || body.includes("23505") || body.includes("duplicate key")) {
    return { ok: true, duplicate: true };
  }
  return { ok: false, status: res.status, error: body };
}

/** Mark a claimed delivery successfully processed (capture written to the brain). */
export async function markProcessed(id: string): Promise<PaResult<void>> {
  return patchRow(id, { processed: true, error_text: null });
}

/** Record why a matched delivery could not be processed (leaves processed=false). */
export async function markError(id: string, errorText: string): Promise<PaResult<void>> {
  return patchRow(id, { processed: false, error_text: errorText.slice(0, 2000) });
}

/**
 * Release a claim by deleting its audit row, so a transient failure (e.g. a GitHub commit blip)
 * lets the next Resend redelivery re-capture instead of being deduped away forever.
 */
export async function releaseInboundClaim(id: string): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { ...authHeaders(env.key), Prefer: "return=minimal" },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

async function patchRow(id: string, patch: Record<string, unknown>): Promise<PaResult<void>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
