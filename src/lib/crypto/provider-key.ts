/**
 * AES-256-GCM authenticated encryption for BYO LLM provider API keys.
 *
 * Deliberately standalone from lib/crypto/encrypt.ts (the Gmail-token module): its own
 * env key (LLM_PROVIDER_KEY_ENCRYPTION_KEY) gives the BYO-LLM surface a clean,
 * independent key-rotation path — rotating the LLM key never touches stored Gmail
 * tokens and vice-versa. The wire format and primitives are identical to encrypt.ts.
 *
 * Master key: LLM_PROVIDER_KEY_ENCRYPTION_KEY — 32 bytes, base64-encoded.
 * Generate with: openssl rand -base64 32
 *
 * Ciphertext envelope is the compact string `v1.<iv>.<tag>.<ct>` (each segment
 * base64url). Bumping the `v1` tag lets a future key rotation migrate without a format
 * rewrite: decrypt v1 with the raw key, re-encrypt as v2.
 */
import crypto from "node:crypto";

export class ProviderKeyConfigError extends Error {
  readonly code = "PROVIDER_KEY_CONFIG_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "ProviderKeyConfigError";
  }
}

export class ProviderKeyDecryptionError extends Error {
  readonly code = "PROVIDER_KEY_DECRYPTION_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "ProviderKeyDecryptionError";
  }
}

const ENV_KEY = "LLM_PROVIDER_KEY_ENCRYPTION_KEY";
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env[ENV_KEY];
  if (!raw) {
    throw new ProviderKeyConfigError(
      `${ENV_KEY} is not configured — cannot encrypt or decrypt BYO LLM provider keys. ` +
        "Generate with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new ProviderKeyConfigError(
      `${ENV_KEY} must decode to exactly 32 bytes (got ${key.length}). ` +
        "Generate with: openssl rand -base64 32",
    );
  }
  return key;
}

/** True when LLM_PROVIDER_KEY_ENCRYPTION_KEY is present and valid (32 bytes). */
export function isProviderKeyConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/** Encrypt plaintext with AES-256-GCM. Returns `v1.<iv>.<tag>.<ct>` (base64url). */
export function encryptProviderKey(plaintext: string): string {
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

/** Decrypt an envelope produced by {@link encryptProviderKey}. Throws on tampering or key mismatch. */
export function decryptProviderKey(envelope: string): string {
  const key = getKey();
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new ProviderKeyDecryptionError("Ciphertext envelope has an unexpected shape");
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
    throw new ProviderKeyDecryptionError(
      `Decryption failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}
