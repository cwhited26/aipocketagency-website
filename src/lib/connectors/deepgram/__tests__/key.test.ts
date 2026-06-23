// Unit tests for the Deepgram API-key crypto (MP-CORE-2): encryption round-trip + failure modes.

import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptDeepgramKey,
  encryptDeepgramKey,
  isDeepgramKeyConfigured,
  DeepgramKeyConfigError,
  DeepgramKeyDecryptionError,
} from "../key";

const VALID_KEY = crypto.randomBytes(32).toString("base64");

beforeEach(() => {
  process.env.DEEPGRAM_API_KEY_ENCRYPTION_KEY = VALID_KEY;
});

afterEach(() => {
  process.env.DEEPGRAM_API_KEY_ENCRYPTION_KEY = VALID_KEY;
});

describe("deepgram-key encryption", () => {
  it("round-trips a plaintext key", () => {
    const plaintext = "dg_live_abc123def456ghi789";
    const envelope = encryptDeepgramKey(plaintext);
    expect(envelope.startsWith("v1.")).toBe(true);
    expect(envelope).not.toContain(plaintext);
    expect(decryptDeepgramKey(envelope)).toBe(plaintext);
  });

  it("produces a fresh IV per call", () => {
    const a = encryptDeepgramKey("same");
    const b = encryptDeepgramKey("same");
    expect(a).not.toBe(b);
    expect(decryptDeepgramKey(a)).toBe("same");
  });

  it("reports configured state", () => {
    expect(isDeepgramKeyConfigured()).toBe(true);
    delete process.env.DEEPGRAM_API_KEY_ENCRYPTION_KEY;
    expect(isDeepgramKeyConfigured()).toBe(false);
  });

  it("throws on a tampered envelope", () => {
    const envelope = encryptDeepgramKey("secret");
    const parts = envelope.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptDeepgramKey(parts.join("."))).toThrow(DeepgramKeyDecryptionError);
  });

  it("throws a config error when the key is missing or wrong length", () => {
    delete process.env.DEEPGRAM_API_KEY_ENCRYPTION_KEY;
    expect(() => encryptDeepgramKey("x")).toThrow(DeepgramKeyConfigError);
    process.env.DEEPGRAM_API_KEY_ENCRYPTION_KEY = Buffer.from("short").toString("base64");
    expect(() => encryptDeepgramKey("x")).toThrow(DeepgramKeyConfigError);
  });
});
