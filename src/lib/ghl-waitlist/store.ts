// lib/ghl-waitlist/store.ts — service-role data layer for pa_ghl_agency_waitlist (migration 109).
// Direct PostgREST, no SDK — matches lib/webinar/registrations.ts. Upsert on email so a repeat
// submission refreshes the row instead of erroring; per the PostgREST gotcha, a secondary unique
// needs the explicit ?on_conflict=email or the upsert 23505s.

import type { GhlWaitlistEntry } from "./schema";

const TABLE = "pa_ghl_agency_waitlist";

export type GhlWaitlistRow = {
  id: string;
  owner_id: string | null;
  name: string;
  email: string;
  agency_name: string;
  client_count: number;
  top_frustration: string;
  referrer: string | null;
  created_at: string;
};

export type UpsertResult =
  | { ok: true; row: GhlWaitlistRow }
  | { ok: false; status: number; error: string };

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

export async function upsertWaitlistEntry(entry: GhlWaitlistEntry): Promise<UpsertResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?on_conflict=email`,
    {
      method: "POST",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        owner_id: null,
        name: entry.name,
        email: entry.email,
        agency_name: entry.agencyName,
        client_count: entry.clientCount,
        top_frustration: entry.topFrustration,
        referrer: entry.referrer || null,
      }),
      cache: "no-store",
    },
  );

  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text };

  let rows: GhlWaitlistRow[];
  try {
    rows = JSON.parse(text) as GhlWaitlistRow[];
  } catch {
    return { ok: false, status: 500, error: `PostgREST returned non-JSON: ${text}` };
  }
  const row = rows[0];
  if (!row) return { ok: false, status: 500, error: "PostgREST returned no row" };
  return { ok: true, row };
}
