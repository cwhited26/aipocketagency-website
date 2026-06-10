// lib/channels/adapters/slack/signing.ts — the Slack adapter's request-signature verification.
//
// PA-CHAN-4: every inbound webhook is HMAC-verified before its body is trusted; the gateway never
// accepts unsigned traffic. This is the gateway's own copy of the v0 signing check (the adapter
// pattern keeps each adapter self-contained — the gateway must not couple to the legacy
// connectors/slack module, which can be retired independently).
//
// basestring = `v0:${timestamp}:${rawBody}` ; expected = `v0=` + HMAC_SHA256(signingSecret, basestring).
// `rawBody` MUST be the exact bytes Slack sent (read before JSON parsing) — re-serializing changes
// whitespace and breaks the HMAC.

import crypto from "node:crypto";

// Slack's verification guide: reject a request whose timestamp is more than 5 minutes from now.
// The replay-attack window.
const MAX_TIMESTAMP_SKEW_SECONDS = 60 * 5;

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "stale_timestamp" | "bad_signature" };

export function verifySlackSignature(args: {
  signingSecret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  nowSeconds: number;
}): SignatureCheck {
  const { signingSecret, timestamp, signature, rawBody, nowSeconds } = args;
  if (!timestamp || !signature) return { ok: false, reason: "missing_headers" };

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const expected =
    "v0=" +
    crypto.createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex");

  // Constant-time compare. timingSafeEqual throws on length mismatch, so guard length first — a
  // wrong-length signature is simply a bad signature.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}
