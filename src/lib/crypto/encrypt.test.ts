import { afterEach, beforeEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  encrypt,
  decrypt,
  signState,
  verifyState,
  EncryptionConfigError,
  DecryptionError,
} from "./encrypt";

const KEY_A = crypto.randomBytes(32).toString("base64");
const KEY_B = crypto.randomBytes(32).toString("base64");

const ORIGINAL = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.GMAIL_TOKEN_ENCRYPTION_KEY = KEY_A;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  else process.env.GMAIL_TOKEN_ENCRYPTION_KEY = ORIGINAL;
});

describe("encrypt / decrypt", () => {
  it("round-trips plaintext", () => {
    const secret = "1//refresh-token-abc.DEF_123-xyz";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("round-trips unicode and empty strings", () => {
    expect(decrypt(encrypt(""))).toBe("");
    expect(decrypt(encrypt("café ☕ 日本語"))).toBe("café ☕ 日本語");
  });

  it("produces a versioned 4-segment envelope", () => {
    const parts = encrypt("x").split(".");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
  });

  it("uses a fresh IV per call (no deterministic ciphertext)", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("throws DecryptionError on a tampered ciphertext segment", () => {
    const env = encrypt("tamper-me");
    const parts = env.split(".");
    // Flip the last char of the ciphertext segment.
    const ct = parts[3];
    parts[3] = ct.slice(0, -1) + (ct.at(-1) === "A" ? "B" : "A");
    expect(() => decrypt(parts.join("."))).toThrow(DecryptionError);
  });

  it("throws DecryptionError on a malformed envelope", () => {
    expect(() => decrypt("not-an-envelope")).toThrow(DecryptionError);
    expect(() => decrypt("v2.a.b.c")).toThrow(DecryptionError);
  });

  it("cannot be decrypted with a different key", () => {
    const env = encrypt("cross-key");
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = KEY_B;
    expect(() => decrypt(env)).toThrow(DecryptionError);
  });

  it("throws EncryptionConfigError when the key is missing", () => {
    delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(EncryptionConfigError);
  });

  it("throws EncryptionConfigError when the key is the wrong length", () => {
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    expect(() => encrypt("x")).toThrow(EncryptionConfigError);
  });
});

describe("signState / verifyState", () => {
  it("round-trips a body", () => {
    const body = JSON.stringify({ userId: "u1", nonce: "abc", exp: 123 });
    expect(verifyState(signState(body))).toBe(body);
  });

  it("rejects a tampered body", () => {
    const token = signState("legit");
    const [b64, mac] = token.split(".");
    const forged = Buffer.from("forged", "utf8").toString("base64url");
    expect(() => verifyState(`${forged}.${mac}`)).toThrow(DecryptionError);
  });

  it("rejects a token with no separator", () => {
    expect(() => verifyState("nodot")).toThrow(DecryptionError);
  });

  it("rejects a token signed with a different key", () => {
    const token = signState("payload");
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = KEY_B;
    expect(() => verifyState(token)).toThrow(DecryptionError);
  });
});
