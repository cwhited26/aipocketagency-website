// connectors/sms/config.ts — Twilio account credentials + the single source of truth for the
// inbound webhook URL. Direct REST only (Chase's standing rule — no Twilio SDK).
//
// Credential model: ONE platform Twilio account (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN), the
// same pair the Patrick build already uses. Every owner's number lives under that account; the
// per-owner binding is the pa_sms_numbers row, not a per-owner credential. If PA ever needs its
// own isolated Twilio account, set PA_TWILIO_ACCOUNT_SID / PA_TWILIO_AUTH_TOKEN and they win.

export type TwilioConfig = { accountSid: string; authToken: string };

/** The Twilio account credentials, or null when this deployment hasn't set them. */
export function twilioConfig(): TwilioConfig | null {
  const accountSid = process.env.PA_TWILIO_ACCOUNT_SID ?? process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.PA_TWILIO_AUTH_TOKEN ?? process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return { accountSid, authToken };
}

/** True iff the SMS connector is configured (account SID + auth token on the env). */
export function isSmsConfigured(): boolean {
  return twilioConfig() !== null;
}

const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

/**
 * The public URL Twilio POSTs inbound texts to. Derived from PA_OAUTH_REDIRECT_BASE (the same env
 * every connector uses) — NEVER the request host. This is the bit-exact string set as the number's
 * SmsUrl at provision time AND the string the signature verifier signs over, so the two can't drift.
 */
export function smsInboundUrl(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(
    /\/+$/,
    "",
  );
  return `${base}/api/connectors/sms/inbound`;
}

/** HTTP Basic auth header for the Twilio REST API (base64 of accountSid:authToken). */
export function twilioBasicAuth(config: TwilioConfig): string {
  return `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`;
}

/** Base path for the account's REST resources. */
export function twilioAccountBase(config: TwilioConfig): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}`;
}

export type TwilioResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };
