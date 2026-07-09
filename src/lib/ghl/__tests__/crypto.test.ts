// GHL token encryption — roundtrip, tamper rejection, and the GMAIL-key fallback that keeps the
// flow alive until GHL_TOKEN_ENCRYPTION_KEY is set on Vercel.

import { afterEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { decryptGhlToken, encryptGhlToken } from "../crypto";
import { DecryptionError, EncryptionConfigError } from "@/lib/crypto/encrypt";

const KEY_A = crypto.randomBytes(32).toString("base64");
const KEY_B = crypto.randomBytes(32).toString("base64");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encryptGhlToken / decryptGhlToken", () => {
  it("roundtrips under GHL_TOKEN_ENCRYPTION_KEY", () => {
    vi.stubEnv("GHL_TOKEN_ENCRYPTION_KEY", KEY_A);
    const envelope = encryptGhlToken("ghl-refresh-token-123");
    expect(envelope.startsWith("v1.")).toBe(true);
    expect(envelope).not.toContain("ghl-refresh-token-123");
    expect(decryptGhlToken(envelope)).toBe("ghl-refresh-token-123");
  });

  it("falls back to GMAIL_TOKEN_ENCRYPTION_KEY when the GHL key is unset", () => {
    vi.stubEnv("GHL_TOKEN_ENCRYPTION_KEY", "");
    vi.stubEnv("GMAIL_TOKEN_ENCRYPTION_KEY", KEY_A);
    const envelope = encryptGhlToken("fallback-secret");
    expect(decryptGhlToken(envelope)).toBe("fallback-secret");
  });

  it("rejects a tampered envelope", () => {
    vi.stubEnv("GHL_TOKEN_ENCRYPTION_KEY", KEY_A);
    const envelope = encryptGhlToken("secret");
    const parts = envelope.split(".");
    const flipped = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3].slice(0, -2)}AA`;
    expect(() => decryptGhlToken(flipped)).toThrow(DecryptionError);
  });

  it("rejects ciphertext from a different key", () => {
    vi.stubEnv("GHL_TOKEN_ENCRYPTION_KEY", KEY_A);
    const envelope = encryptGhlToken("secret");
    vi.stubEnv("GHL_TOKEN_ENCRYPTION_KEY", KEY_B);
    expect(() => decryptGhlToken(envelope)).toThrow(DecryptionError);
  });

  it("throws a config error when no key is available at all", () => {
    vi.stubEnv("GHL_TOKEN_ENCRYPTION_KEY", "");
    vi.stubEnv("GMAIL_TOKEN_ENCRYPTION_KEY", "");
    expect(() => encryptGhlToken("secret")).toThrow(EncryptionConfigError);
  });
});
