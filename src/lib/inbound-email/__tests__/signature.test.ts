import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyResendSignature } from "../signature";

// Build a valid Svix-style signature for a given secret/id/timestamp/body.
function sign(secretB64: string, id: string, ts: string, body: string): string {
  const key = Buffer.from(secretB64, "base64");
  const sig = crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return `v1,${sig}`;
}

const SECRET_B64 = Buffer.from("a".repeat(24)).toString("base64");
const SECRET = `whsec_${SECRET_B64}`;

describe("verifyResendSignature", () => {
  const id = "msg_123";
  const body = JSON.stringify({ type: "email.received", data: { subject: "hi" } });

  it("accepts a correctly signed payload", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = sign(SECRET_B64, id, ts, body);
    const result = verifyResendSignature(body, { id, timestamp: ts, signature }, SECRET);
    expect(result.ok).toBe(true);
  });

  it("accepts when one of several signature entries matches", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const good = sign(SECRET_B64, id, ts, body);
    const signature = `v1,AAAA ${good}`;
    expect(verifyResendSignature(body, { id, timestamp: ts, signature }, SECRET).ok).toBe(true);
  });

  it("rejects a tampered body", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = sign(SECRET_B64, id, ts, body);
    const result = verifyResendSignature(body + "x", { id, timestamp: ts, signature }, SECRET);
    expect(result.ok).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = sign(SECRET_B64, id, ts, body);
    const other = `whsec_${Buffer.from("b".repeat(24)).toString("base64")}`;
    expect(verifyResendSignature(body, { id, timestamp: ts, signature }, other).ok).toBe(false);
  });

  it("rejects missing headers", () => {
    expect(
      verifyResendSignature(body, { id: null, timestamp: null, signature: null }, SECRET).ok,
    ).toBe(false);
  });

  it("rejects a stale timestamp outside the tolerance window", () => {
    const ts = String(Math.floor(Date.now() / 1000) - 10 * 60); // 10 min ago
    const signature = sign(SECRET_B64, id, ts, body);
    const result = verifyResendSignature(body, { id, timestamp: ts, signature }, SECRET);
    expect(result.ok).toBe(false);
  });

  it("rejects when the secret is not configured", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifyResendSignature(body, { id, timestamp: ts, signature: "v1,x" }, "").ok).toBe(false);
  });
});
