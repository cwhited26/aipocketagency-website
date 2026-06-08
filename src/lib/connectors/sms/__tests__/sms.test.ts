// Pure-function unit tests for the SMS connector — no network, no DB. Exercises the Twilio
// signature scheme (against Twilio's own documented vector), the outbound segment splitter, the
// inbound payload parser + content composer, area-code normalization, and the AvailablePhoneNumbers
// search URL builder.

import { describe, expect, it } from "vitest";
import { computeTwilioSignature, verifyTwilioSignature } from "../signature";
import { splitSmsSegments } from "../send";
import { parseInboundSms, isAudioMedia, composeInboundContent } from "../inbound";
import { normalizeAreaCode, availableNumbersUrl } from "../provision";
import type { TwilioConfig } from "../config";

describe("Twilio signature", () => {
  // Known-answer vector: the base64 HMAC-SHA1 of (URL + sorted key/value concatenation) under the
  // auth token, per Twilio's documented validateRequest algorithm. Pinned so a change to the
  // concatenation/sort/encoding is caught.
  const authToken = "12345";
  const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
  const params = {
    CallSid: "CA1234567890ABCDE",
    Caller: "+14158675310",
    Digits: "1234",
    From: "+14158675310",
    To: "+18005551212",
  };
  const expected = "GvWf1cFY/Q7PnoempGyD5oXAezc=";

  it("computes the documented signature", () => {
    expect(computeTwilioSignature(authToken, url, params)).toBe(expected);
  });

  it("verifies a valid signature", () => {
    expect(verifyTwilioSignature({ authToken, url, params, signature: expected })).toBe(true);
  });

  it("rejects a tampered body", () => {
    const tampered = { ...params, Digits: "9999" };
    expect(verifyTwilioSignature({ authToken, url, params: tampered, signature: expected })).toBe(false);
  });

  it("rejects a wrong auth token", () => {
    expect(verifyTwilioSignature({ authToken: "wrong", url, params, signature: expected })).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyTwilioSignature({ authToken, url, params, signature: null })).toBe(false);
  });

  it("is order-independent on params (sorted internally)", () => {
    const reordered = {
      To: "+18005551212",
      From: "+14158675310",
      Digits: "1234",
      Caller: "+14158675310",
      CallSid: "CA1234567890ABCDE",
    };
    expect(computeTwilioSignature(authToken, url, reordered)).toBe(expected);
  });
});

describe("splitSmsSegments", () => {
  it("returns a single segment for a short reply", () => {
    expect(splitSmsSegments("hello there")).toEqual(["hello there"]);
  });

  it("returns nothing for an empty/whitespace reply", () => {
    expect(splitSmsSegments("   ")).toEqual([]);
  });

  it("splits a long reply on a whitespace boundary, each within the limit", () => {
    const body = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
    const segments = splitSmsSegments(body, 200);
    expect(segments.length).toBeGreaterThan(1);
    for (const seg of segments) expect(seg.length).toBeLessThanOrEqual(200);
    // Rejoining the trimmed segments reconstructs the words (whitespace boundaries preserved).
    expect(segments.join(" ").split(/\s+/)).toEqual(body.split(/\s+/));
  });

  it("hard-cuts an unbroken run with no whitespace", () => {
    const body = "x".repeat(450);
    const segments = splitSmsSegments(body, 200);
    expect(segments.length).toBe(3);
    expect(segments[0].length).toBe(200);
  });
});

describe("parseInboundSms", () => {
  it("parses a plain text message", () => {
    const parsed = parseInboundSms({
      From: "+14158675310",
      To: "+18005551212",
      Body: "Draft a follow-up to Dana",
      MessageSid: "SM123",
      NumMedia: "0",
    });
    expect(parsed).toEqual({
      from: "+14158675310",
      to: "+18005551212",
      body: "Draft a follow-up to Dana",
      messageSid: "SM123",
      media: [],
    });
  });

  it("collects MMS attachments", () => {
    const parsed = parseInboundSms({
      From: "+14158675310",
      To: "+18005551212",
      Body: "",
      MessageSid: "SM999",
      NumMedia: "2",
      MediaUrl0: "https://api.twilio.com/media/0",
      MediaContentType0: "audio/amr",
      MediaUrl1: "https://api.twilio.com/media/1",
      MediaContentType1: "image/jpeg",
    });
    expect(parsed?.media).toEqual([
      { url: "https://api.twilio.com/media/0", contentType: "audio/amr" },
      { url: "https://api.twilio.com/media/1", contentType: "image/jpeg" },
    ]);
  });

  it("falls back to SmsMessageSid when MessageSid is absent", () => {
    const parsed = parseInboundSms({
      From: "+1",
      To: "+2",
      SmsMessageSid: "SM-alt",
      NumMedia: "0",
    });
    expect(parsed?.messageSid).toBe("SM-alt");
  });

  it("returns null when From/To/Sid are missing", () => {
    expect(parseInboundSms({ Body: "hi", NumMedia: "0" })).toBeNull();
  });
});

describe("media + content helpers", () => {
  it("recognises audio attachments", () => {
    expect(isAudioMedia("audio/amr")).toBe(true);
    expect(isAudioMedia("audio/mpeg")).toBe(true);
    expect(isAudioMedia("image/jpeg")).toBe(false);
  });

  it("composes body + transcript + image context in order", () => {
    expect(
      composeInboundContent({
        body: "what's this?",
        transcript: null,
        imageContext: "[Attached image: texted image]",
      }),
    ).toBe("what's this?\n\n[Attached image: texted image]");
  });

  it("falls back to a placeholder when nothing is present", () => {
    expect(composeInboundContent({ body: "", transcript: null, imageContext: null })).toBe(
      "[Empty text message]",
    );
  });
});

describe("area code + search URL", () => {
  it("normalizes bare and full numbers to a 3-digit NPA", () => {
    expect(normalizeAreaCode("615")).toBe("615");
    expect(normalizeAreaCode("(615) 555-1234")).toBe("615");
    expect(normalizeAreaCode("+1 615 555 1234")).toBe("615");
    expect(normalizeAreaCode("")).toBeNull();
    expect(normalizeAreaCode("12")).toBeNull();
  });

  const config: TwilioConfig = { accountSid: "ACxxxx", authToken: "tok" };

  it("scopes the search to an area code when given", () => {
    const url = availableNumbersUrl(config, "615");
    expect(url).toContain("/Accounts/ACxxxx/AvailablePhoneNumbers/US/Local.json");
    expect(url).toContain("AreaCode=615");
    expect(url).toContain("SmsEnabled=true");
  });

  it("omits the area code for a national search", () => {
    const url = availableNumbersUrl(config, null);
    expect(url).not.toContain("AreaCode");
    expect(url).toContain("SmsEnabled=true");
  });
});
