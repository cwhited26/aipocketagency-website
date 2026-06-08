// lib/connectors/system/log.ts — data layer for pa_system_email_log (migration 024), the audit
// trail for every PA system transactional email. The idempotency_key UNIQUE constraint is the
// real cross-invocation dedupe guard: a retried trigger inserts the same key, hits 23505, and we
// skip the send instead of mailing the user twice.
//
// Service-role REST, no SDK — matching pa-inbox-items.ts. paEnv/authHeaders are intentionally
// re-declared per data file (the repo's convention) so this module is self-contained.

export type SystemEmailStatus = "pending" | "sent" | "failed";

type LogResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_system_email_log";

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

/**
 * Claim an idempotency key by inserting a `pending` audit row. Returns `claimed: true` when this
 * caller won the race (proceed to send), or `claimed: false` when a row for the key already
 * exists (another send already happened or is in-flight — do NOT send again). A real transport/DB
 * error is returned typed so the trigger can log it.
 */
export async function claimSystemEmail(input: {
  userId: string;
  toAddress: string;
  subject: string;
  idempotencyKey: string;
}): Promise<LogResult<{ claimed: boolean }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: input.userId,
        to_address: input.toAddress,
        subject: input.subject,
        idempotency_key: input.idempotencyKey,
        status: "pending" satisfies SystemEmailStatus,
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }

  if (res.ok) return { ok: true, data: { claimed: true } };

  const body = await res.text();
  if (isUniqueViolation(res.status, body)) {
    // Key already claimed — the send already ran (or is running). Skip, don't duplicate.
    return { ok: true, data: { claimed: false } };
  }
  return { ok: false, status: res.status, error: body };
}

/** Mark a claimed row sent with the Resend id + timestamp. Keyed on the unique idempotency key. */
export async function markSystemEmailSent(input: {
  idempotencyKey: string;
  resendId: string;
  sentAt: string;
}): Promise<LogResult<undefined>> {
  return patchByKey(input.idempotencyKey, {
    status: "sent",
    resend_id: input.resendId,
    sent_at: input.sentAt,
  });
}

/** Mark a claimed row failed with the transport error. Keyed on the unique idempotency key. */
export async function markSystemEmailFailed(input: {
  idempotencyKey: string;
  errorMessage: string;
}): Promise<LogResult<undefined>> {
  return patchByKey(input.idempotencyKey, {
    status: "failed",
    error_message: input.errorMessage.slice(0, 2000),
  });
}

async function patchByKey(
  idempotencyKey: string,
  fields: Record<string, string>,
): Promise<LogResult<undefined>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(
      `${env.url}/rest/v1/${TABLE}?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}`,
      {
        method: "PATCH",
        headers: {
          ...authHeaders(env.key),
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
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
