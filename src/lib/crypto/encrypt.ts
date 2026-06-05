/**
 * AES-256-GCM authenticated encryption + HMAC-SHA256 state signing for the
 * Connections Gmail OAuth flow.
 *
 * Master key: GMAIL_TOKEN_ENCRYPTION_KEY — 32 bytes, base64-encoded.
 * Generate with: openssl rand -base64 32
 *
 * Ciphertext envelope is the compact string `v1.<iv>.<tag>.<ct>` (each segment
 * base64url). Bumping the `v1` tag lets a future key rotation migrate without a
 * format rewrite: decrypt v1 with the raw key, re-encrypt as v2.
 *
 * This module is deliberately standalone (its own env key + tests) so the
 * Connections surface does not depend on the legacy pa-vault key chain.
 */
import crypto from "node:crypto";

export class EncryptionConfigError extends Error {
  readonly code = "ENCRYPTION_CONFIG_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "EncryptionConfigError";
  }
}

export class DecryptionError extends Error {
  readonly code = "DECRYPTION_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

const ENV_KEY = "GMAIL_TOKEN_ENCRYPTION_KEY";
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env[ENV_KEY];
  if (!raw) {
    throw new EncryptionConfigError(
      `${ENV_KEY} is not configured — cannot encrypt or decrypt Gmail tokens. ` +
        "Generate with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new EncryptionConfigError(
      `${ENV_KEY} must decode to exactly 32 bytes (got ${key.length}). ` +
        "Generate with: openssl rand -base64 32",
    );
  }
  return key;
}

/** Encrypt plaintext with AES-256-GCM. Returns `v1.<iv>.<tag>.<ct>` (base64url). */
export function encrypt(plaintext: string): string {
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

/** Decrypt an envelope produced by {@link encrypt}. Throws on any tampering or key mismatch. */
export function decrypt(envelope: string): string {
  const key = getKey();
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new DecryptionError("Ciphertext envelope has an unexpected shape");
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
      `Decryption failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}

// ─── OAuth CSRF state signing (HMAC-SHA256, same master key) ───────────────────

/** Sign an arbitrary string body with HMAC-SHA256. Returns `<body>.<mac>` (base64url body). */
export function signState(body: string): string {
  const key = getKey();
  const b64 = Buffer.from(body, "utf8").toString("base64url");
  const mac = crypto.createHmac("sha256", key).update(b64).digest("base64url");
  return `${b64}.${mac}`;
}

/**
 * Verify a token produced by {@link signState} and return the original body.
 * Throws {@link DecryptionError} on a missing/invalid signature (constant-time compare).
 */
export function verifyState(token: string): string {
  const key = getKey();
  const dot = token.lastIndexOf(".");
  if (dot === -1) throw new DecryptionError("State token: missing signature separator");

  const b64 = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", key).update(b64).digest("base64url");

  const macBuf = Buffer.from(mac);
  const expBuf = Buffer.from(expected);
  if (macBuf.length !== expBuf.length || !crypto.timingSafeEqual(macBuf, expBuf)) {
    throw new DecryptionError("State token: signature invalid");
  }
  return Buffer.from(b64, "base64url").toString("utf8");
}
