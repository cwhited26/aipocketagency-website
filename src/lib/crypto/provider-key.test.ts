import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  encryptProviderKey,
  decryptProviderKey,
  isProviderKeyConfigured,
  ProviderKeyConfigError,
  ProviderKeyDecryptionError,
} from "./provider-key";

const ENV = "LLM_PROVIDER_KEY_ENCRYPTION_KEY";
// A deterministic 32-byte base64 key for the suite.
const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

describe("provider-key crypto", () => {
  const original = process.env[ENV];
  beforeAll(() => {
    process.env[ENV] = TEST_KEY;
  });
  afterAll(() => {
    if (original === undefined) delete process.env[ENV];
    else process.env[ENV] = original;
  });

  it("reports configured when a valid 32-byte key is set", () => {
    expect(isProviderKeyConfigured()).toBe(true);
  });

  it("round-trips a secret", () => {
    const secret = "sk-ant-api03-super-secret-value";
    const envelope = encryptProviderKey(secret);
    expect(envelope.startsWith("v1.")).toBe(true);
    expect(envelope).not.toContain(secret);
    expect(decryptProviderKey(envelope)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptProviderKey("same");
    const b = encryptProviderKey("same");
    expect(a).not.toBe(b);
    expect(decryptProviderKey(a)).toBe("same");
    expect(decryptProviderKey(b)).toBe("same");
  });

  it("rejects a tampered envelope", () => {
    const envelope = encryptProviderKey("secret");
    const parts = envelope.split(".");
    parts[3] = parts[3].slice(0, -2) + "00";
    expect(() => decryptProviderKey(parts.join("."))).toThrow(ProviderKeyDecryptionError);
  });

  it("rejects a malformed envelope shape", () => {
    expect(() => decryptProviderKey("not-an-envelope")).toThrow(ProviderKeyDecryptionError);
  });

  it("throws a config error when the key is the wrong length", () => {
    const prev = process.env[ENV];
    process.env[ENV] = Buffer.alloc(16, 1).toString("base64");
    try {
      expect(() => encryptProviderKey("x")).toThrow(ProviderKeyConfigError);
      expect(isProviderKeyConfigured()).toBe(false);
    } finally {
      process.env[ENV] = prev;
    }
  });
});
