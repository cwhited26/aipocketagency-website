// lib/channels/adapters/imessage/signing.ts — verify the X-BB-Signature header on an inbound
// BlueBubbles webhook (Channels Gateway Phase 3, PA-CHAN-4). The owner configures their BlueBubbles
// server to sign each delivery: HMAC-SHA256 over the raw request body, hex-encoded, keyed by the
// webhook secret they pasted at connect time. Pure + unit-testable (no network).

import crypto from "node:crypto";

export const BB_SIGNATURE_HEADER = "x-bb-signature";

/** Compute the expected hex HMAC-SHA256 signature for a raw body. Pure. */
export function computeBlueBubblesSignature(secret: string, rawBody: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/**
 * True iff `signature` matches the expected HMAC for `rawBody` under `secret`. Constant-time
 * compare; a missing/malformed signature returns false rather than throwing.
 */
export function verifyBlueBubblesSignature(args: {
  secret: string;
  rawBody: string;
  signature: string | null;
}): boolean {
  if (!args.signature) return false;
  const expected = computeBlueBubblesSignature(args.secret, args.rawBody);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(args.signature.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
