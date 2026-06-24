// entitlement.ts — is this signed-in account a Pocket Capture standalone buyer? (PC-MARK-3)
//
// "pocket_capture_user" is NOT a column (PC-MARK-2 decision) — it's the existence of a
// pocket_agent_addon_purchases ledger row with kind=pocket_capture_standalone for this account.
// The row is keyed by user_id when the buyer was signed in at checkout, or by email and claimed on
// first login (migration 065), so we match either — the same owner-OR-email gate the DIY Kit uses.

import { paEnv, authHeaders } from "./supabase";
import { POCKET_CAPTURE_ADDON_KIND } from "./product";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/**
 * True when the account owns a Pocket Capture standalone purchase. Matches the ledger on
 * user_id OR (lowercased) email, so a guest-checkout row claimed-by-email still entitles the
 * account once they sign in. Returns ok:false only on an infrastructure error — callers decide
 * whether to fail open or closed (the onboarding guard fails closed → PA Launch Kit).
 */
export async function isPocketCaptureUser(params: {
  userId: string;
  email: string | null;
}): Promise<PaResult<boolean>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  // PostgREST embedded-OR syntax: each condition is column.operator.value inside or=(...).
  const conditions = [`user_id.eq.${encodeURIComponent(params.userId)}`];
  if (params.email) conditions.push(`email.eq.${encodeURIComponent(params.email.toLowerCase())}`);
  const orClause = `or=(${conditions.join(",")})`;

  const res = await fetch(
    `${env.url}/rest/v1/pocket_agent_addon_purchases` +
      `?kind=eq.${encodeURIComponent(POCKET_CAPTURE_ADDON_KIND)}&${orClause}&select=id&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as { id: string }[];
  return { ok: true, data: rows.length > 0 };
}
