// Pure-function tests for the Channels Gateway Slack signature verification (PA-CHAN-4) — no
// network. Covers valid, missing-headers, stale-timestamp (replay window), and forged signatures.

import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySlackSignature } from "../signing";

const SECRET = "8f742c6c5d1b4a3e9f0a1b2c3d4e5f60";

function sign(rawBody: string, timestamp: number): string {
  return "v0=" + crypto.createHmac("sha256", SECRET).update(`v0:${timestamp}:${rawBody}`).digest("hex");
}

describe("verifySlackSignature", () => {
  const now = 1_700_000_000;
  const body = JSON.stringify({ type: "event_callback" });

  it("accepts a correctly signed, fresh request", () => {
    const res = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(now),
      signature: sign(body, now),
      rawBody: body,
      nowSeconds: now,
    });
    expect(res.ok).toBe(true);
  });

  it("rejects missing headers", () => {
    const res = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: null,
      signature: null,
      rawBody: body,
      nowSeconds: now,
    });
    expect(res).toEqual({ ok: false, reason: "missing_headers" });
  });

  it("rejects a stale timestamp outside the 5-minute replay window", () => {
    const ts = now - 60 * 10;
    const res = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(ts),
      signature: sign(body, ts),
      rawBody: body,
      nowSeconds: now,
    });
    expect(res).toEqual({ ok: false, reason: "stale_timestamp" });
  });

  it("rejects a forged signature", () => {
    const res = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(now),
      signature: "v0=deadbeef",
      rawBody: body,
      nowSeconds: now,
    });
    expect(res).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a body that doesn't match the signed bytes", () => {
    const res = verifySlackSignature({
      signingSecret: SECRET,
      timestamp: String(now),
      signature: sign(body, now),
      rawBody: body + " tampered",
      nowSeconds: now,
    });
    expect(res).toEqual({ ok: false, reason: "bad_signature" });
  });
});
