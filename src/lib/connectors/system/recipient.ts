// lib/connectors/system/recipient.ts — resolve a PA user's deliverable email from their auth
// identity. pocket_agent_users has no email column; the address lives in Supabase auth, so we read
// it via the GoTrue admin REST endpoint with the service-role key. Used by the Daily Brief and
// approval-needed triggers, which only hold a user_id. (The connection re-auth trigger already
// has the connected mailbox address and skips this.)

type RecipientResult =
  | { ok: true; email: string | null }
  | { ok: false; status: number; error: string };

function authEnv(): { url: string; key: string } | { error: string } {
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

/** Look up the auth email for a user id. Returns `email: null` when the user has no address. */
export async function fetchAuthUserEmail(userId: string): Promise<RecipientResult> {
  const env = authEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(`${env.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };

  const parsed = (await res.json()) as { email?: string | null };
  return { ok: true, email: parsed.email ?? null };
}
