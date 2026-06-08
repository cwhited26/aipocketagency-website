// addresses.ts — data layer for pa_inbound_addresses (service-role REST, no SDK).
//
// Two reads the routing path needs (lookup an owner by local-part + kind; list an owner's
// addresses for the UI) and one idempotent write (ensure both addresses exist, provisioning
// a slug of the account name with a random-token fallback on collision).

import { slugifyLocalPart, localPartWithSuffix, randomToken } from "./slug";
import type { AddressKind } from "./parse";

export type InboundAddress = {
  id: string;
  owner_id: string;
  local_part: string;
  kind: AddressKind;
  created_at: string;
};

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TABLE = "pa_inbound_addresses";

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

// ── Reads ──────────────────────────────────────────────────────────────────────

/** Resolve the owner id behind a (kind, local_part) pair — the inbound webhook's routing key. */
export async function lookupOwnerByLocalPart(
  localPart: string,
  kind: AddressKind,
): Promise<PaResult<string | null>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?kind=eq.${encodeURIComponent(kind)}` +
      `&local_part=eq.${encodeURIComponent(localPart)}` +
      `&select=owner_id&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as { owner_id: string }[];
  return { ok: true, data: rows[0]?.owner_id ?? null };
}

/** Both of an owner's addresses (for the Connections card + privacy page). */
export async function fetchAddressesForOwner(
  ownerId: string,
): Promise<PaResult<InboundAddress[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?owner_id=eq.${encodeURIComponent(ownerId)}&select=*`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as InboundAddress[] };
}

// ── Provisioning (idempotent) ────────────────────────────────────────────────────

// True iff the local-part is already taken (for this kind) by another owner.
async function localPartTaken(
  env: { url: string; key: string },
  kind: AddressKind,
  localPart: string,
): Promise<boolean> {
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}?kind=eq.${encodeURIComponent(kind)}&local_part=eq.${encodeURIComponent(localPart)}&select=id&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return true; // fail safe — treat as taken so we fall back to a unique token
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

// Insert one address row, tolerating the (owner_id, kind) unique constraint (already
// provisioned) as a no-op success.
async function insertAddress(
  env: { url: string; key: string },
  ownerId: string,
  kind: AddressKind,
  localPart: string,
): Promise<PaResult<void>> {
  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ owner_id: ownerId, kind, local_part: localPart }),
    cache: "no-store",
  });
  if (res.ok) return { ok: true, data: undefined };
  const body = await res.text();
  // 23505 = duplicate key. (owner_id, kind) already present → idempotent success.
  if (res.status === 409 || body.includes("23505") || body.includes("duplicate key")) {
    return { ok: true, data: undefined };
  }
  return { ok: false, status: res.status, error: body };
}

/**
 * Ensure an owner has both addresses, provisioning any that are missing. Idempotent:
 * safe to call on every signup, page load, or webhook. The local-part is a slug of
 * `seedName`; on a cross-owner collision (or an unusable name) it appends a random token
 * until it lands a free one. Both addresses share the same local-part when possible.
 */
export async function ensureInboundAddresses(
  ownerId: string,
  seedName: string,
): Promise<PaResult<InboundAddress[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const existing = await fetchAddressesForOwner(ownerId);
  if (!existing.ok) return existing;
  const have = new Set(existing.data.map((a) => a.kind));
  if (have.has("inbound") && have.has("bcc")) return existing;

  // Reuse the already-chosen local-part if one address exists, so both match.
  const chosen = existing.data[0]?.local_part ?? null;
  let localPart = chosen;

  if (!localPart) {
    const base = slugifyLocalPart(seedName) || "owner";
    // Try the bare slug, then slug-<token> until both kinds are free.
    const candidates = [base, ...Array.from({ length: 5 }, () => localPartWithSuffix(base, randomToken()))];
    for (const candidate of candidates) {
      const inboundTaken = !have.has("inbound") && (await localPartTaken(env, "inbound", candidate));
      const bccTaken = !have.has("bcc") && (await localPartTaken(env, "bcc", candidate));
      if (!inboundTaken && !bccTaken) {
        localPart = candidate;
        break;
      }
    }
    // Exhausted the retries (astronomically unlikely) → a guaranteed-unique token.
    if (!localPart) localPart = localPartWithSuffix(base, randomToken(8));
  }

  if (!have.has("inbound")) {
    const r = await insertAddress(env, ownerId, "inbound", localPart);
    if (!r.ok) return r;
  }
  if (!have.has("bcc")) {
    const r = await insertAddress(env, ownerId, "bcc", localPart);
    if (!r.ok) return r;
  }

  return fetchAddressesForOwner(ownerId);
}
