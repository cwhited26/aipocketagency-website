// signature.ts — verify the Svix-signed webhook Resend sends for inbound email.
//
// Resend delivers inbound-email webhooks through Svix, which signs every request with
// three headers: svix-id, svix-timestamp, svix-signature. The signed content is
// `${id}.${timestamp}.${rawBody}`, HMAC-SHA256'd with the endpoint's signing secret
// (a base64 value prefixed `whsec_`). svix-signature is a space-separated list of
// `v1,<base64sig>` entries (a secret rotation can publish more than one). We accept the
// request if any entry matches, using a constant-time compare.
//
// Pure + dependency-free (node:crypto only, standing rule #6 — no SDK). Tested directly.

import crypto from "node:crypto";

export type SignatureHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

// Reject timestamps more than this far from now (replay-window guard), matching Svix's
// own 5-minute default tolerance.
const TOLERANCE_SECONDS = 5 * 60;

/** Strip the `whsec_` prefix (if present) and base64-decode the secret to raw key bytes. */
function secretKeyBytes(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Buffer.from(raw, "base64");
}

function timingSafeEqualB64(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Resend/Svix inbound webhook signature against the raw request body.
 *
 * @param rawBody  The exact bytes of the request body (verify BEFORE JSON.parse — any
 *                 re-serialization changes the signed content and fails the check).
 * @param headers  The svix-id / svix-timestamp / svix-signature header values.
 * @param secret   The endpoint signing secret (RESEND_INBOUND_SIGNING_SECRET).
 * @param nowMs    Injectable clock for tests; defaults to Date.now().
 */
export function verifyResendSignature(
  rawBody: string,
  headers: SignatureHeaders,
  secret: string,
  nowMs: number = Date.now(),
): VerifyResult {
  if (!secret) return { ok: false, reason: "signing secret not configured" };
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "missing svix signature headers" };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "invalid timestamp header" };
  const skew = Math.abs(nowMs / 1000 - ts);
  if (skew > TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp outside tolerance window" };
  }

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const key = secretKeyBytes(secret);
  if (key.length === 0) return { ok: false, reason: "signing secret decodes to empty" };

  const expected = crypto.createHmac("sha256", key).update(signedContent).digest("base64");

  // svix-signature: space-separated `v1,<sig>` entries. Match any.
  for (const entry of signature.split(" ")) {
    const comma = entry.indexOf(",");
    const candidate = comma === -1 ? entry : entry.slice(comma + 1);
    if (candidate && timingSafeEqualB64(candidate, expected)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "no matching signature" };
}
