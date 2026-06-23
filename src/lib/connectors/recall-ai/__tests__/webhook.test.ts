// Unit tests for the Recall.ai webhook helpers (MP-CORE-1): signature verification (pos + neg),
// event parsing, status mapping, and recording-URL extraction. No network.

import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  extractRecordingUrl,
  mapRecallStatusToSessionStatus,
  parseRecallEvent,
  RECALL_EVENT,
  verifyRecallSignature,
} from "../webhook";

// Build a valid Svix-style signature for a given signed content + whsec secret.
function signSvix(signedContent: string, secretWhsec: string): string {
  const key = Buffer.from(secretWhsec.slice("whsec_".length), "base64");
  const sig = crypto.createHmac("sha256", key).update(signedContent, "utf8").digest("base64");
  return `v1,${sig}`;
}

const SECRET = `whsec_${Buffer.from("a-very-secret-signing-key-32bytes!!").toString("base64")}`;

describe("verifyRecallSignature", () => {
  const id = "msg_2abc";
  const ts = "1718000000";
  const body = JSON.stringify({ event: "bot.status_change", data: { bot: { id: "bot_1" } } });
  const signedContent = `${id}.${ts}.${body}`;

  it("accepts a valid signature (positive)", () => {
    const header = signSvix(signedContent, SECRET);
    expect(verifyRecallSignature(signedContent, header, SECRET)).toBe(true);
  });

  it("accepts when the header carries multiple space-delimited tokens", () => {
    const valid = signSvix(signedContent, SECRET);
    const header = `v1,AAAAwrongAAAA ${valid}`;
    expect(verifyRecallSignature(signedContent, header, SECRET)).toBe(true);
  });

  it("rejects a tampered body (negative)", () => {
    const header = signSvix(signedContent, SECRET);
    const tampered = `${id}.${ts}.${body}TAMPER`;
    expect(verifyRecallSignature(tampered, header, SECRET)).toBe(false);
  });

  it("rejects a wrong secret (negative)", () => {
    const header = signSvix(signedContent, SECRET);
    const otherSecret = `whsec_${Buffer.from("different-key-different-key-32b!!").toString("base64")}`;
    expect(verifyRecallSignature(signedContent, header, otherSecret)).toBe(false);
  });

  it("rejects a missing header or secret (negative)", () => {
    expect(verifyRecallSignature(signedContent, null, SECRET)).toBe(false);
    expect(verifyRecallSignature(signedContent, "v1,x", null)).toBe(false);
    expect(verifyRecallSignature(signedContent, "", SECRET)).toBe(false);
  });

  it("supports a raw (non-whsec) secret key too", () => {
    const raw = "plain-secret";
    const sig = crypto.createHmac("sha256", Buffer.from(raw, "utf8")).update(signedContent).digest("base64");
    expect(verifyRecallSignature(signedContent, `v1,${sig}`, raw)).toBe(true);
  });
});

describe("parseRecallEvent", () => {
  it("extracts event type + bot id from data.bot.id", () => {
    const parsed = parseRecallEvent({ event: RECALL_EVENT.TRANSCRIPT_DONE, data: { bot: { id: "bot_9" } } });
    expect(parsed).toEqual({ eventType: "transcript.done", botId: "bot_9", statusCode: null });
  });

  it("extracts the status code for a status_change event", () => {
    const parsed = parseRecallEvent({
      event: RECALL_EVENT.BOT_STATUS_CHANGE,
      data: { bot: { id: "bot_3" }, data: { code: "in_call_recording" } },
    });
    expect(parsed?.botId).toBe("bot_3");
    expect(parsed?.statusCode).toBe("in_call_recording");
  });

  it("returns null for an unparseable payload", () => {
    expect(parseRecallEvent({ nope: true })).toBeNull();
    expect(parseRecallEvent("string")).toBeNull();
  });
});

describe("mapRecallStatusToSessionStatus", () => {
  it("maps known codes", () => {
    expect(mapRecallStatusToSessionStatus("joining_call")).toBe("joining");
    expect(mapRecallStatusToSessionStatus("in_call_recording")).toBe("recording");
    expect(mapRecallStatusToSessionStatus("call_ended")).toBe("left");
    expect(mapRecallStatusToSessionStatus("fatal")).toBe("failed");
  });

  it("returns null for unknown / missing codes", () => {
    expect(mapRecallStatusToSessionStatus("something_new")).toBeNull();
    expect(mapRecallStatusToSessionStatus(null)).toBeNull();
  });
});

describe("extractRecordingUrl", () => {
  it("pulls a URL from the documented locations", () => {
    expect(extractRecordingUrl({ data: { recording: { url: "https://x/rec.mp4" } } })).toBe("https://x/rec.mp4");
    expect(extractRecordingUrl({ data: { video_url: "https://x/v.mp4" } })).toBe("https://x/v.mp4");
  });

  it("returns null when no URL is present", () => {
    expect(extractRecordingUrl({ data: {} })).toBeNull();
    expect(extractRecordingUrl(42)).toBeNull();
  });
});
