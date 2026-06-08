// connectors/sms/signature.ts — verify the X-Twilio-Signature header on an inbound webhook so a
// forged POST can't inject a text into someone's PA thread. Pure + unit-testable (no network).
//
// Twilio's scheme (https://www.twilio.com/docs/usage/security#validating-requests):
//   1. Start with the full request URL Twilio called (exactly as configured as the number's SmsUrl).
//   2. Sort the POST params by key; append each key immediately followed by its value (no
//      separators), in sorted order, to the URL string.
//   3. HMAC-SHA1 that string with the account's auth token; base64-encode the digest.
//   4. Constant-time compare against the X-Twilio-Signature header.

import crypto from "node:crypto";

/** Compute the expected base64 X-Twilio-Signature for a URL + form params. Pure. */
export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

/**
 * True iff `signature` matches the expected HMAC for (url, params) under `authToken`. Uses a
 * constant-time comparison so a mismatch can't be timed. A malformed/empty signature returns false
 * rather than throwing.
 */
export function verifyTwilioSignature(args: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string | null;
}): boolean {
  if (!args.signature) return false;
  const expected = computeTwilioSignature(args.authToken, args.url, args.params);
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(args.signature, "utf-8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
