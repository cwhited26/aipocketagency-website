// permissions-db.ts — data layer for pa_browser_domain_permissions (service-role REST, no SDK).
// One row per (owner, domain) the owner has an explicit rule for: allow/deny + the Trust-Ladder
// auto_approve flag. A domain with no row falls through to the default (allow, card-gated).

import { paEnv, authHeaders } from "./supabase";
import type { DomainPermission } from "./trust-ladder";

const TABLE = "pa_browser_domain_permissions";

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export type DomainPermissionRow = {
  id: string;
  owner_id: string;
  domain: string;
  decision: "allow" | "deny";
  auto_approve: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchDomainPermission(ownerId: string, domain: string): Promise<PaResult<DomainPermission | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}&domain=eq.${encodeURIComponent(domain)}&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as DomainPermissionRow[];
  const row = rows[0];
  if (!row) return { ok: true, data: null };
  return { ok: true, data: { decision: row.decision, autoApprove: row.auto_approve } };
}

export async function listDomainPermissions(ownerId: string): Promise<PaResult<DomainPermissionRow[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}&order=domain.asc`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as DomainPermissionRow[];
  return { ok: true, data: rows };
}

/**
 * Insert-or-update the owner's rule for a domain. Uses PostgREST upsert on the (owner_id, domain)
 * unique constraint (Prefer: resolution=merge-duplicates) so a second write updates in place.
 */
export async function upsertDomainPermission(params: {
  ownerId: string;
  domain: string;
  decision: "allow" | "deny";
  autoApprove: boolean;
}): Promise<PaResult<DomainPermissionRow>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(`${env.url}/rest/v1/${TABLE}?on_conflict=owner_id,domain`, {
    method: "POST",
    headers: {
      ...authHeaders(env.key),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      owner_id: params.ownerId,
      domain: params.domain,
      decision: params.decision,
      auto_approve: params.autoApprove,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as DomainPermissionRow[];
  if (!rows[0]) return { ok: false, status: 500, error: "No row returned after upsert." };
  return { ok: true, data: rows[0] };
}
