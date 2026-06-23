// Unit tests for the Recall.ai API-key crypto (MP-CORE-1): encryption round-trip + tamper/config
// failure modes.

import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptRecallKey,
  encryptRecallKey,
  isRecallKeyConfigured,
  RecallKeyConfigError,
  RecallKeyDecryptionError,
} from "../recall-key";

const VALID_KEY = crypto.randomBytes(32).toString("base64");

beforeEach(() => {
  process.env.RECALL_API_KEY_ENCRYPTION_KEY = VALID_KEY;
});

afterEach(() => {
  process.env.RECALL_API_KEY_ENCRYPTION_KEY = VALID_KEY;
});

describe("recall-key encryption", () => {
  it("round-trips a plaintext key", () => {
    const plaintext = "recall_sk_live_abc123def456";
    const envelope = encryptRecallKey(plaintext);
    expect(envelope.startsWith("v1.")).toBe(true);
    expect(envelope).not.toContain(plaintext);
    expect(decryptRecallKey(envelope)).toBe(plaintext);
  });

  it("produces a fresh IV per call (distinct envelopes, same plaintext)", () => {
    const a = encryptRecallKey("same");
    const b = encryptRecallKey("same");
    expect(a).not.toBe(b);
    expect(decryptRecallKey(a)).toBe("same");
    expect(decryptRecallKey(b)).toBe("same");
  });

  it("reports configured state", () => {
    expect(isRecallKeyConfigured()).toBe(true);
    delete process.env.RECALL_API_KEY_ENCRYPTION_KEY;
    expect(isRecallKeyConfigured()).toBe(false);
  });

  it("throws on a tampered envelope", () => {
    const envelope = encryptRecallKey("secret");
    const parts = envelope.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptRecallKey(parts.join("."))).toThrow(RecallKeyDecryptionError);
  });

  it("throws a config error when the key is missing", () => {
    delete process.env.RECALL_API_KEY_ENCRYPTION_KEY;
    expect(() => encryptRecallKey("x")).toThrow(RecallKeyConfigError);
  });

  it("throws a config error when the key is the wrong length", () => {
    process.env.RECALL_API_KEY_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    expect(() => encryptRecallKey("x")).toThrow(RecallKeyConfigError);
  });
});
