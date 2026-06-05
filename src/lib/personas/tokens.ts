// tokens.ts — opaque share-token generation for persona seats. We deliberately use a
// random, DB-backed opaque token (not a self-contained JWT) so a revoke takes effect
// within one request: every chat request looks the token up in persona_share_tokens
// and checks revoked_at/expires_at (SPEC v3 Success Criterion #7 — revoke within 10s).

import crypto from "node:crypto";

const TOKEN_BYTES = 32;

/** Generates a URL-safe, unguessable share token (256 bits of entropy). */
export function generateShareToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url");
}

/** True when a token row is currently usable (exists, not revoked, not expired). */
export function isTokenLive(
  row: { revoked_at: string | null; expires_at: string | null },
  now: Date = new Date(),
): boolean {
  if (row.revoked_at) return false;
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) return false;
  return true;
}
