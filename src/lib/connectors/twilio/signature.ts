// connectors/twilio/signature.ts — Pocket Capture-scoped wrapper around the pure Twilio signature
// verifier. Binds the canonical capture webhook URL (the bit-exact string the number's SmsUrl was
// provisioned with) and the platform auth token, so the route just passes the parsed form params +
// the X-Twilio-Signature header. Reuses connectors/sms/signature.ts (the HMAC-SHA1 scheme is
// account-wide, not Channels-Gateway-specific).

import { verifyTwilioSignature } from "@/lib/connectors/sms/signature";
import { twilioConfig } from "@/lib/connectors/sms/config";
import { captureSmsWebhookUrl } from "./config";

export type CaptureSignatureResult =
  | { ok: true }
  | { ok: false; reason: "not-configured" | "bad-signature" };

/**
 * Verify a Pocket Capture inbound SMS webhook. Fails closed: a missing auth token is
 * "not-configured" (a 500-class fault — never process unsigned mail), a mismatch is
 * "bad-signature" (401). The URL signed over is captureSmsWebhookUrl(), identical to the SmsUrl
 * set at provision time.
 */
export function verifyCaptureSmsSignature(
  params: Record<string, string>,
  signature: string | null,
): CaptureSignatureResult {
  const config = twilioConfig();
  if (!config) return { ok: false, reason: "not-configured" };

  const valid = verifyTwilioSignature({
    authToken: config.authToken,
    url: captureSmsWebhookUrl(),
    params,
    signature,
  });
  return valid ? { ok: true } : { ok: false, reason: "bad-signature" };
}
