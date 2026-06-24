// api-tokens.ts — per-user personal API tokens for the Pocket Capture iOS Shortcut surface
// (PC-CORE-4). Data layer for pa_pocket_capture_api_tokens (service-role REST, no SDK — standing
// rule), plus the pure crypto used to mint + verify tokens.
//
// Security model:
//   • A token is `pca_` + base64url(32 random bytes). The plaintext is returned to the caller
//     exactly once (at mint) and never stored — we persist only its SHA-256 hash + a short,
//     non-secret prefix for display.
//   • verifyApiToken hashes the inbound token, looks the row up by that hash (an indexed equality
//     on a non-reversible digest), then does a constant-time compare against the stored hash as
//     defense-in-depth before trusting it. A revoked token (revoked_at set) never matches.
//   • Revocation is a soft delete (set revoked_at), owner-scoped so a user can only revoke their own.

import crypto from "node:crypto";
import { paEnv, authHeaders } from "./supabase";

const TABLE = "pa_pocket_capture_api_tokens";

/** Every Pocket Capture token starts with this human-recognizable scheme prefix. */
export const API_TOKEN_PREFIX = "pca_";

/** Bytes of entropy in the random part of a token. 32 bytes = 256 bits. */
const TOKEN_BYTES = 32;

/** Chars of the token shown in the management UI (e.g. "pca_abcd"). Non-secret. */
const DISPLAY_PREFIX_LENGTH = 8;

type PaResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export type ApiTokenRow = {
  id: string;
  token_prefix: string;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

// ─── Pure crypto helpers (directly unit-tested) ─────────────────────────────────────

/** SHA-256 (hex) of a token. The only form of a token we ever persist. */
export function hashApiToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/** The non-secret display prefix for a token (e.g. "pca_abcd"). */
export function apiTokenPrefix(token: string): string {
  return token.slice(0, DISPLAY_PREFIX_LENGTH);
}

/** Shape-check an inbound token before any hashing or DB work: must be `pca_` + a non-empty body. */
export function isWellFormedApiToken(token: string): boolean {
  return token.startsWith(API_TOKEN_PREFIX) && token.length > API_TOKEN_PREFIX.length;
}

/**
 * Constant-time equality of two hex digests. Guards length first (timingSafeEqual throws on a
 * length mismatch) and returns false instead of throwing, so a malformed input can't leak timing
 * or crash the verify path. Equal-length inputs are compared in constant time.
 */
export function constantTimeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Mint fresh token material: the plaintext (returned once), its display prefix, and its hash (what
 * we store). Pure aside from the CSPRNG draw, so the format + roundtrip are unit-testable.
 */
export function mintTokenMaterial(): {
  tokenPlaintext: string;
  tokenPrefix: string;
  tokenHash: string;
} {
  const tokenPlaintext = API_TOKEN_PREFIX + crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  return {
    tokenPlaintext,
    tokenPrefix: apiTokenPrefix(tokenPlaintext),
    tokenHash: hashApiToken(tokenPlaintext),
  };
}

// ─── Data layer ─────────────────────────────────────────────────────────────────────

/**
 * Mint a new personal API token for an owner and persist its hash + prefix (+ optional friendly
 * name). Returns the plaintext exactly once — the caller MUST surface it to the user immediately,
 * because it is never recoverable afterwards.
 */
export async function generateApiToken(
  ownerId: string,
  name?: string,
): Promise<PaResult<{ tokenPlaintext: string; tokenPrefix: string }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const material = mintTokenMaterial();
  const res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      owner_id: ownerId,
      token_hash: material.tokenHash,
      token_prefix: material.tokenPrefix,
      name: name?.trim() ? name.trim().slice(0, 200) : null,
    }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };

  return {
    ok: true,
    data: { tokenPlaintext: material.tokenPlaintext, tokenPrefix: material.tokenPrefix },
  };
}

/**
 * Verify an inbound bearer token. Returns the owning user id, or null when the token is malformed,
 * unknown, or revoked. Touches last_used_at on success (best-effort: a failed touch is logged, not
 * fatal — the token is still valid). Uses a hash lookup + a constant-time compare as defense-in-depth.
 */
export async function verifyApiToken(token: string): Promise<{ ownerId: string } | null> {
  if (!isWellFormedApiToken(token)) return null;

  const env = paEnv();
  if ("error" in env) return null;

  const hash = hashApiToken(token);
  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?token_hash=eq.${encodeURIComponent(hash)}&revoked_at=is.null` +
      `&select=id,owner_id,token_hash&limit=1`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as { id: string; owner_id: string; token_hash: string }[];
  const row = rows[0];
  if (!row) return null;
  // Defense-in-depth: confirm the stored hash matches in constant time before trusting the row.
  if (!constantTimeEqualHex(hash, row.token_hash)) return null;

  await touchLastUsed(env.url, env.key, row.id);
  return { ownerId: row.owner_id };
}

/**
 * List an owner's active (not-revoked) tokens, newest first. Never returns the hash or any secret —
 * only the display prefix + timestamps + friendly name, which is all the management UI needs.
 */
export async function listApiTokens(ownerId: string): Promise<PaResult<ApiTokenRow[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?owner_id=eq.${encodeURIComponent(ownerId)}&revoked_at=is.null` +
      `&select=id,token_prefix,name,created_at,last_used_at,revoked_at&order=created_at.desc`,
    { headers: authHeaders(env.key), cache: "no-store" },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as ApiTokenRow[];
  return { ok: true, data: rows };
}

/**
 * Soft-revoke a token (set revoked_at). Owner-scoped: the WHERE clause pins both id AND owner_id, so
 * a user can never revoke another user's token. `revoked` reports whether a row actually matched
 * (false = the id wasn't theirs or was already revoked) so the route can 404 honestly.
 */
export async function revokeApiToken(
  tokenId: string,
  ownerId: string,
): Promise<PaResult<{ revoked: boolean }>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const res = await fetch(
    `${env.url}/rest/v1/${TABLE}` +
      `?id=eq.${encodeURIComponent(tokenId)}&owner_id=eq.${encodeURIComponent(ownerId)}` +
      `&revoked_at=is.null`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const rows = (await res.json()) as unknown[];
  return { ok: true, data: { revoked: rows.length > 0 } };
}

/** Best-effort last_used_at touch. Logs (never throws) on failure — verification already succeeded. */
async function touchLastUsed(url: string, key: string, id: string): Promise<void> {
  const res = await fetch(`${url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...authHeaders(key), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[pocket-capture/api-tokens] last_used_at touch failed", {
      tokenId: id,
      status: res.status,
    });
  }
}
