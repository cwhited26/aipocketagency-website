/**
 * AES-256-GCM authenticated encryption for the owner's Recall.ai API key (Meeting Persona,
 * MP-CORE-1).
 *
 * Deliberately standalone from lib/crypto/encrypt.ts (Gmail tokens) and lib/crypto/provider-key.ts
 * (BYO LLM keys): its own env key (RECALL_API_KEY_ENCRYPTION_KEY) gives the Meeting Persona surface
 * a clean, independent key-rotation path — rotating the Recall key never touches stored Gmail or LLM
 * keys and vice-versa. This is the repo's established per-surface crypto convention; the wire format
 * and primitives are identical to the sibling modules.
 *
 * Master key: RECALL_API_KEY_ENCRYPTION_KEY — 32 bytes, base64-encoded.
 * Generate with: openssl rand -base64 32
 *
 * Ciphertext envelope is the compact string `v1.<iv>.<tag>.<ct>` (each segment base64url). Bumping
 * the `v1` tag lets a future key rotation migrate without a format rewrite: decrypt v1 with the raw
 * key, re-encrypt as v2.
 */
import crypto from "node:crypto";

export class RecallKeyConfigError extends Error {
  readonly code = "RECALL_KEY_CONFIG_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "RecallKeyConfigError";
  }
}

export class RecallKeyDecryptionError extends Error {
  readonly code = "RECALL_KEY_DECRYPTION_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "RecallKeyDecryptionError";
  }
}

const ENV_KEY = "RECALL_API_KEY_ENCRYPTION_KEY";
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env[ENV_KEY];
  if (!raw) {
    throw new RecallKeyConfigError(
      `${ENV_KEY} is not configured — cannot encrypt or decrypt Recall.ai API keys. ` +
        "Generate with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new RecallKeyConfigError(
      `${ENV_KEY} must decode to exactly 32 bytes (got ${key.length}). ` +
        "Generate with: openssl rand -base64 32",
    );
  }
  return key;
}

/** True when RECALL_API_KEY_ENCRYPTION_KEY is present and valid (32 bytes). */
export function isRecallKeyConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/** Encrypt plaintext with AES-256-GCM. Returns `v1.<iv>.<tag>.<ct>` (base64url). */
export function encryptRecallKey(plaintext: string): string {
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

/** Decrypt an envelope produced by {@link encryptRecallKey}. Throws on tampering or key mismatch. */
export function decryptRecallKey(envelope: string): string {
  const key = getKey();
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new RecallKeyDecryptionError("Ciphertext envelope has an unexpected shape");
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
    throw new RecallKeyDecryptionError(
      `Decryption failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}
