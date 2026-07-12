// keys.ts — hashing + per-workspace key generation for the master-keyed workspace endpoint.
// Master keys and per-workspace keys are BOTH stored as SHA-256 hashes only; plaintext is
// never persisted. A per-workspace key looks like `pa_ws_<32 hex chars>`.

import crypto from "node:crypto";

/** SHA-256 hex of a plaintext secret. Deterministic; used for storage + lookup. */
export function sha256Hex(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/** The prefix every per-workspace key carries. */
export const WORKSPACE_KEY_SCHEME = "pa_ws_";

export type GeneratedWorkspaceKey = {
  /** The full secret — returned to the caller ONCE, never stored. */
  plaintext: string;
  /** SHA-256 hex of the plaintext, for the api_key_hashed column. */
  keyHash: string;
};

/** Generates a fresh `pa_ws_<32 hex chars>` key plus its hash. */
export function generateWorkspaceKey(): GeneratedWorkspaceKey {
  // 16 random bytes → exactly 32 hex chars after the scheme tag.
  const plaintext = `${WORKSPACE_KEY_SCHEME}${crypto.randomBytes(16).toString("hex")}`;
  return { plaintext, keyHash: sha256Hex(plaintext) };
}

/** Extracts the bearer token from an Authorization header, or null when absent/malformed. */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}
