// crypto.ts — AES-256-GCM for GHL tokens at rest. Same `v1.<iv>.<tag>.<ct>` envelope as
// lib/crypto/encrypt.ts, but keyed by GHL_TOKEN_ENCRYPTION_KEY so the GHL connector can rotate
// independently of the Gmail/Connections key chain. Until Chase sets the GHL key, the module
// falls back to GMAIL_TOKEN_ENCRYPTION_KEY (the key every other connector already rides) so the
// flow works the day the OAuth envs land.

import crypto from "node:crypto";
import { DecryptionError, EncryptionConfigError } from "@/lib/crypto/encrypt";

const PRIMARY_ENV_KEY = "GHL_TOKEN_ENCRYPTION_KEY";
const FALLBACK_ENV_KEY = "GMAIL_TOKEN_ENCRYPTION_KEY";
const VERSION = "v1";

function getKey(): Buffer {
  // Empty-string envs count as unset (a cleared Vercel var arrives as ""), so this is ||, not ??.
  const primary = process.env[PRIMARY_ENV_KEY];
  const raw = primary && primary.length > 0 ? primary : process.env[FALLBACK_ENV_KEY];
  if (!raw) {
    throw new EncryptionConfigError(
      `${PRIMARY_ENV_KEY} is not configured (and no ${FALLBACK_ENV_KEY} fallback) — cannot ` +
        "encrypt or decrypt GHL tokens. Generate with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new EncryptionConfigError(
      `${PRIMARY_ENV_KEY} must decode to exactly 32 bytes (got ${key.length}). ` +
        "Generate with: openssl rand -base64 32",
    );
  }
  return key;
}

/** Encrypt a GHL token. Returns `v1.<iv>.<tag>.<ct>` (base64url segments). */
export function encryptGhlToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

/** Decrypt an envelope produced by {@link encryptGhlToken}. Throws DecryptionError on tamper. */
export function decryptGhlToken(envelope: string): string {
  const key = getKey();
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new DecryptionError("GHL token envelope has an unexpected shape");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  try {
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const ct = Buffer.from(ctB64, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch (err) {
    throw new DecryptionError(
      `GHL token decryption failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}
