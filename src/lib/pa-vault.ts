/**
 * AES-256-GCM envelope encryption + HMAC-SHA256 OAuth state signing.
 *
 * Master key: PA_CONNECTIONS_ENC_KEY — 32 bytes, base64-encoded.
 * Generate with: openssl rand -base64 32
 *
 * v1 envelope shape is stable; bump "v" to migrate to a KMS-wrapped data-key
 * without a rewrite — decrypt v1 with raw key, re-encrypt as v2 with envelope key.
 */
import crypto from "node:crypto";
import { z } from "zod";

// ─── Typed errors ─────────────────────────────────────────────────────────────

export class VaultConfigError extends Error {
  readonly code = "VAULT_CONFIG_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "VaultConfigError";
  }
}

export class VaultDecryptError extends Error {
  readonly code = "VAULT_DECRYPT_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "VaultDecryptError";
  }
}

// ─── Master key ───────────────────────────────────────────────────────────────

function getMasterKey(): Buffer {
  const raw = process.env.PA_CONNECTIONS_ENC_KEY;
  if (!raw) {
    throw new VaultConfigError(
      "PA_CONNECTIONS_ENC_KEY is not configured — cannot encrypt or decrypt secrets. " +
        "Generate with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new VaultConfigError(
      `PA_CONNECTIONS_ENC_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
        "Generate with: openssl rand -base64 32",
    );
  }
  return key;
}

// ─── AES-256-GCM envelope ─────────────────────────────────────────────────────

const VaultPayloadSchema = z.object({
  v: z.literal(1),
  iv: z.string().min(1),
  tag: z.string().min(1),
  ct: z.string().min(1),
});

/** Encrypt plaintext with AES-256-GCM. Returns a JSON-serialised v1 envelope. */
export function vaultEncrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ctBuf = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ctBuf.toString("base64"),
  });
}

/** Decrypt a v1 envelope produced by vaultEncrypt. Throws on any failure. */
export function vaultDecrypt(stored: string): string {
  const key = getMasterKey();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new VaultDecryptError("Vault envelope is not valid JSON");
  }
  const result = VaultPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new VaultDecryptError("Vault envelope has unexpected shape");
  }
  try {
    const iv = Buffer.from(result.data.iv, "base64");
    const tag = Buffer.from(result.data.tag, "base64");
    const ct = Buffer.from(result.data.ct, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch (err) {
    throw new VaultDecryptError(
      `Decryption failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}

// ─── OAuth CSRF state ─────────────────────────────────────────────────────────

const StatePayloadSchema = z.object({
  userId: z.string().uuid(),
  provider: z.enum(["google_gmail", "google_calendar"]),
  callbackUrl: z.string().url(),
  nonce: z.string().min(16),
  exp: z.number().int().positive(),
});

export type OAuthStatePayload = z.infer<typeof StatePayloadSchema>;

/** Sign an OAuth state payload with HMAC-SHA256. Returns `<base64url_body>.<base64url_mac>`. */
export function signOAuthState(payload: OAuthStatePayload): string {
  const key = getMasterKey();
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${mac}`;
}

/**
 * Verify and decode a signed OAuth state token.
 * Throws VaultDecryptError on signature failure, expiry, or bad shape.
 */
export function verifyOAuthState(state: string): OAuthStatePayload {
  const key = getMasterKey();
  const dot = state.lastIndexOf(".");
  if (dot === -1) throw new VaultDecryptError("OAuth state: missing signature separator");

  const body = state.slice(0, dot);
  const mac = state.slice(dot + 1);

  const expectedBuf = Buffer.from(
    crypto.createHmac("sha256", key).update(body).digest("base64url"),
  );
  const macBuf = Buffer.from(mac);

  if (
    macBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(macBuf, expectedBuf)
  ) {
    throw new VaultDecryptError("OAuth state: signature invalid");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new VaultDecryptError("OAuth state: payload is not valid JSON");
  }

  const parsed = StatePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new VaultDecryptError("OAuth state: payload shape invalid");
  }
  if (Date.now() > parsed.data.exp) {
    throw new VaultDecryptError("OAuth state: token has expired");
  }
  return parsed.data;
}
