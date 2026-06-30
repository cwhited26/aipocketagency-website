// Tests for the Telegram adapter's inbound secret-token verification (PA-CHAN-4) and the connect-time
// secret-format guard. No network: pure constant-time compare + a format regex.

import { describe, expect, it } from "vitest";
import { verifyTelegramSecret, isValidTelegramSecretToken } from "../signing";

describe("verifyTelegramSecret", () => {
  const expectedSecret = "s3cret_Token-ABC123";

  it("accepts a matching header secret", () => {
    expect(verifyTelegramSecret({ expectedSecret, headerSecret: expectedSecret })).toEqual({ ok: true });
  });

  it("rejects a wrong secret as bad_secret (never throws on equal length)", () => {
    const wrong = "s3cret_Token-XYZ999"; // same length, different value
    expect(verifyTelegramSecret({ expectedSecret, headerSecret: wrong })).toEqual({
      ok: false,
      reason: "bad_secret",
    });
  });

  it("rejects a wrong-length secret as bad_secret (guards timingSafeEqual)", () => {
    expect(verifyTelegramSecret({ expectedSecret, headerSecret: "short" })).toEqual({
      ok: false,
      reason: "bad_secret",
    });
  });

  it("rejects a missing header as missing_header", () => {
    expect(verifyTelegramSecret({ expectedSecret, headerSecret: null })).toEqual({
      ok: false,
      reason: "missing_header",
    });
  });
});

describe("isValidTelegramSecretToken", () => {
  it("accepts letters, digits, underscore and hyphen", () => {
    expect(isValidTelegramSecretToken("Abc_123-XYZ")).toBe(true);
  });

  it("accepts the full 256-char length", () => {
    expect(isValidTelegramSecretToken("a".repeat(256))).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidTelegramSecretToken("")).toBe(false);
  });

  it("rejects over 256 chars", () => {
    expect(isValidTelegramSecretToken("a".repeat(257))).toBe(false);
  });

  it("rejects disallowed characters (spaces, punctuation)", () => {
    expect(isValidTelegramSecretToken("has spaces")).toBe(false);
    expect(isValidTelegramSecretToken("has.dot")).toBe(false);
    expect(isValidTelegramSecretToken("emoji😀")).toBe(false);
  });
});
