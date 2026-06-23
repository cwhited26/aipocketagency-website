// The Pocket Capture inbound webhook reuses verifyResendSignature (Svix HMAC) with its own secret
// (RESEND_INBOUND_WEBHOOK_SECRET). These tests pin the positive + negative paths for that contract.

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyResendSignature } from "@/lib/inbound-email/signature";

const SECRET_B64 = Buffer.from("pocket-capture-test-signing-key").toString("base64");
const SECRET = `whsec_${SECRET_B64}`;

function sign(id: string, timestamp: string, body: string, secret = SECRET): string {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = Buffer.from(raw, "base64");
  const sig = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return `v1,${sig}`;
}

describe("verifyResendSignature (capture webhook contract)", () => {
  const id = "msg_abc";
  const ts = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: "email.inbound", data: { to: "x@capture.aipocketagent.com" } });

  it("accepts a correctly signed request", () => {
    const r = verifyResendSignature(body, { id, timestamp: ts, signature: sign(id, ts, body) }, SECRET);
    expect(r.ok).toBe(true);
  });

  it("rejects a tampered body", () => {
    const r = verifyResendSignature(
      body + "tampered",
      { id, timestamp: ts, signature: sign(id, ts, body) },
      SECRET,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const wrong = `whsec_${Buffer.from("not-the-real-key").toString("base64")}`;
    const r = verifyResendSignature(body, { id, timestamp: ts, signature: sign(id, ts, body, wrong) }, SECRET);
    expect(r.ok).toBe(false);
  });

  it("rejects when signature headers are missing", () => {
    const r = verifyResendSignature(body, { id: null, timestamp: null, signature: null }, SECRET);
    expect(r.ok).toBe(false);
  });

  it("rejects a stale timestamp outside the tolerance window", () => {
    const stale = String(Math.floor(Date.now() / 1000) - 60 * 60);
    const r = verifyResendSignature(body, { id, timestamp: stale, signature: sign(id, stale, body) }, SECRET);
    expect(r.ok).toBe(false);
  });
});
