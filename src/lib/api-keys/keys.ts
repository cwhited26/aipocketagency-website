// keys.ts — PA API key generation, hashing, and validation. Keys look like
// `pa_live_<random>`. We store ONLY the SHA-256 hash + a short display prefix; the
// plaintext is shown to the user exactly once at generation and never persisted.

import crypto from "node:crypto";
import {
  fetchApiKeyByHash,
  insertApiKey,
  touchLastUsed,
  type ApiKeyRow,
} from "./db";

export const KEY_SCHEME = "pa_live_";
// Length of the stored display prefix: `pa_live_` (8) + 4 random chars = a useful,
// non-secret label like `pa_live_a1b2…` for the management table.
const PREFIX_LEN = 12;

export type GeneratedKey = {
  /** The full secret — returned to the caller ONCE, never stored. */
  plaintext: string;
  keyHash: string;
  keyPrefix: string;
};

/** SHA-256 hex of the full plaintext key. Deterministic; used for storage + lookup. */
export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/** Generates a fresh `pa_live_<random>` key plus its hash and display prefix. */
export function generateApiKey(): GeneratedKey {
  // 24 random bytes → 32 url-safe chars of entropy after the scheme tag.
  const random = crypto.randomBytes(24).toString("base64url");
  const plaintext = `${KEY_SCHEME}${random}`;
  return {
    plaintext,
    keyHash: hashApiKey(plaintext),
    keyPrefix: plaintext.slice(0, PREFIX_LEN),
  };
}

/** Extracts the bearer token from an Authorization header, or null when absent/malformed. */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/** True when the token has the expected `pa_live_` shape (cheap pre-check before hashing). */
export function looksLikePaKey(token: string): boolean {
  return token.startsWith(KEY_SCHEME) && token.length > KEY_SCHEME.length + 8;
}

export async function createApiKeyForUser(params: {
  userId: string;
  name: string;
  scopes: string[];
}): Promise<{ plaintext: string; row: ApiKeyRow }> {
  const { plaintext, keyHash, keyPrefix } = generateApiKey();
  const row = await insertApiKey({
    user_id: params.userId,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    name: params.name,
    scopes: params.scopes,
  });
  return { plaintext, row };
}

export type KeyValidation =
  | { ok: true; key: ApiKeyRow }
  | { ok: false; reason: "missing" | "malformed" | "invalid" | "revoked" };

/**
 * Validates a presented bearer token against pa_api_keys by SHA-256 hash. Rejects
 * missing, malformed, unknown, and revoked keys. On success, fire-and-forget updates
 * last_used_at (a failed touch never blocks the request).
 */
export async function validateApiKey(authHeader: string | null): Promise<KeyValidation> {
  const token = extractBearerToken(authHeader);
  if (!token) return { ok: false, reason: "missing" };
  if (!looksLikePaKey(token)) return { ok: false, reason: "malformed" };

  const row = await fetchApiKeyByHash(hashApiKey(token));
  if (!row) return { ok: false, reason: "invalid" };
  if (row.revoked_at) return { ok: false, reason: "revoked" };

  void touchLastUsed(row.id).catch(() => undefined);
  return { ok: true, key: row };
}
