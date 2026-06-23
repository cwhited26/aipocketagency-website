// connectors/twilio/config.ts — the single source of truth for the two URLs Pocket Capture wires
// onto a freshly-provisioned number: the SMS capture webhook and a no-op voice fallback.
//
// Why this lives apart from connectors/sms/config.ts: that module's smsInboundUrl() points the
// Channels Gateway number at the *conversational agent* (/api/connectors/sms/inbound). Pocket
// Capture's SMS surface is a different flow entirely — the owner texting their OWN number to drop
// a thought into their brain — so it gets its own webhook. The Twilio account credentials are the
// same platform pair, reused from connectors/sms/config.ts (no second account).
//
// Both URLs are derived from PA_OAUTH_REDIRECT_BASE (the same env every connector uses), NEVER the
// request host. The capture webhook string is bit-exact between the SmsUrl set at provision time
// and the string the signature verifier signs over, so the two can never drift.

const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

/** The public origin Twilio webhooks are wired against. Trailing slashes trimmed. */
function publicBase(): string {
  return (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(/\/+$/, "");
}

/**
 * The URL Twilio POSTs an inbound SMS/MMS to for the Pocket Capture surface. This exact string is
 * set as the number's SmsUrl at provision time AND signed over by the inbound signature verifier.
 */
export function captureSmsWebhookUrl(): string {
  return `${publicBase()}/api/webhooks/twilio-sms-capture`;
}

/**
 * A no-op voice fallback. Pocket Capture never accepts calls, but Twilio requires a VoiceUrl on a
 * voice-capable number; this endpoint answers 200 with an empty TwiML <Response/> so a stray call
 * is silently dropped instead of erroring on Twilio's side.
 */
export function captureVoiceNoopUrl(): string {
  return `${publicBase()}/api/webhooks/twilio-sms-capture/voice`;
}
