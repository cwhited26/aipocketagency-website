// lib/channels/adapters/whatsapp/signing.ts — verify the X-Hub-Signature-256 header on an inbound
// Meta Cloud API webhook (Channels Gateway Phase 4, PA-CHAN-4). Meta signs each delivery:
// "sha256=" + HMAC-SHA256 (hex) over the raw request body, keyed by the app secret. Pure +
// unit-testable (no network).

import crypto from "node:crypto";

export const HUB_SIGNATURE_HEADER = "x-hub-signature-256";

/** Compute the expected "sha256=<hex>" header value for a raw body. Pure. */
export function computeHubSignature(appSecret: string, rawBody: string): string {
  return "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
}

/**
 * True iff `signature` matches the expected HMAC for `rawBody` under `appSecret`. Constant-time
 * compare; a missing/malformed signature returns false rather than throwing.
 */
export function verifyHubSignature(args: {
  appSecret: string;
  rawBody: string;
  signature: string | null;
}): boolean {
  if (!args.signature) return false;
  const expected = computeHubSignature(args.appSecret, args.rawBody);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(args.signature.trim(), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
