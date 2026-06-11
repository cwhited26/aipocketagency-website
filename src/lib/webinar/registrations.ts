// lib/webinar/registrations.ts — the service-role data layer for webinar registrations (migration
// 077). Direct PostgREST, no SDK — matches lib/emails/queue.ts. The table is deny-all RLS, so every
// write goes through the service-role key. Typed results, never a silent empty.

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_webinar_registrations";

export type WebinarRegistrationRow = {
  id: string;
  email: string;
  first_name: string | null;
  phone: string | null;
  registered_at: string;
  webinar_session_id: string | null;
  attended: boolean;
  replay_watched: boolean;
  unsubscribed_at: string | null;
  created_at: string;
};

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

export type RegistrationInput = {
  email: string;
  firstName: string | null;
  phone: string | null;
  webinarSessionId: string | null;
};

/**
 * Idempotent upsert keyed on the unique email index. A re-registration updates the name/phone and
 * re-stamps registered_at (so the sequence re-enqueues against a fresh trigger time). Returns the row.
 */
export async function upsertRegistration(
  input: RegistrationInput,
): Promise<PaResult<WebinarRegistrationRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const email = input.email.trim().toLowerCase();
  const row = {
    email,
    first_name: input.firstName,
    phone: input.phone,
    webinar_session_id: input.webinarSessionId,
    registered_at: new Date().toISOString(),
  };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=email`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as WebinarRegistrationRow[];
  const first = rows[0];
  if (!first) return { ok: false, status: 500, error: "upsert returned no row" };
  return { ok: true, data: first };
}
