/**
 * AES-256-GCM authenticated encryption for the owner's Deepgram API key (Meeting Persona,
 * MP-CORE-2).
 *
 * Standalone from the Gmail / LLM-provider / Recall crypto modules: its own env key
 * (DEEPGRAM_API_KEY_ENCRYPTION_KEY) gives the Deepgram surface an independent key-rotation path —
 * the repo's established per-surface crypto convention. Wire format + primitives are identical to
 * lib/crypto/recall-key.ts.
 *
 * Master key: DEEPGRAM_API_KEY_ENCRYPTION_KEY — 32 bytes, base64-encoded.
 * Generate with: openssl rand -base64 32
 *
 * Ciphertext envelope is `v1.<iv>.<tag>.<ct>` (each segment base64url).
 */
import crypto from "node:crypto";

export class DeepgramKeyConfigError extends Error {
  readonly code = "DEEPGRAM_KEY_CONFIG_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "DeepgramKeyConfigError";
  }
}

export class DeepgramKeyDecryptionError extends Error {
  readonly code = "DEEPGRAM_KEY_DECRYPTION_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "DeepgramKeyDecryptionError";
  }
}

const ENV_KEY = "DEEPGRAM_API_KEY_ENCRYPTION_KEY";
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env[ENV_KEY];
  if (!raw) {
    throw new DeepgramKeyConfigError(
      `${ENV_KEY} is not configured — cannot encrypt or decrypt Deepgram API keys. ` +
        "Generate with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new DeepgramKeyConfigError(
      `${ENV_KEY} must decode to exactly 32 bytes (got ${key.length}). ` +
        "Generate with: openssl rand -base64 32",
    );
  }
  return key;
}

/** True when DEEPGRAM_API_KEY_ENCRYPTION_KEY is present and valid (32 bytes). */
export function isDeepgramKeyConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/** Encrypt plaintext with AES-256-GCM. Returns `v1.<iv>.<tag>.<ct>` (base64url). */
export function encryptDeepgramKey(plaintext: string): string {
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

/** Decrypt an envelope produced by {@link encryptDeepgramKey}. Throws on tampering or key mismatch. */
export function decryptDeepgramKey(envelope: string): string {
  const key = getKey();
  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new DeepgramKeyDecryptionError("Ciphertext envelope has an unexpected shape");
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
    throw new DeepgramKeyDecryptionError(
      `Decryption failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}
