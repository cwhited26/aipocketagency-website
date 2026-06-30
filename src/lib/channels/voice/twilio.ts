// lib/channels/voice/twilio.ts — the Twilio adapter for the Voice Call channel. Direct REST against
// api.twilio.com (no SDK — repo rule). Four jobs:
//   • provisionNumber      — buy a number and point its Voice webhook at our TwiML route.
//   • updateVoiceWebhook   — re-point an existing number's Voice + status URLs.
//   • hangup               — end a live call (the cap-hangup path).
//   • placeTestCall        — outbound call to the owner's own SMS-verified number (test-call button).
//   • verifyTwilioSignature — HMAC-SHA1 of the X-Twilio-Signature header on every inbound webhook.
//
// The Twilio Auth Token is the account credential. It is stored AES-256-GCM-encrypted at rest (the
// pa_channel_connections.auth_token_encrypted envelope via lib/crypto/encrypt.ts) and decrypted only
// at call time by the route, which passes the plaintext into these functions — it never lives here.
// Basic-auth is `Authorization: Basic base64(accountSid:authToken)` per Twilio.

import crypto from "node:crypto";

const TWILIO_API_BASE = "https://api.twilio.com";
const API_VERSION = "2010-04-01";

export class TwilioError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "TwilioError";
    this.status = status;
  }
}

export type TwilioCreds = {
  accountSid: string;
  authToken: string;
};

function basicAuthHeader(creds: TwilioCreds): string {
  const raw = `${creds.accountSid}:${creds.authToken}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

async function twilioForm<T>(
  creds: TwilioCreds,
  method: "GET" | "POST",
  path: string,
  form?: Record<string, string>,
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: basicAuthHeader(creds),
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    cache: "no-store",
  };
  if (form) init.body = new URLSearchParams(form).toString();

  const res = await fetch(`${TWILIO_API_BASE}/${path}`, init);
  const text = await res.text();
  if (!res.ok) {
    throw new TwilioError(
      `Twilio ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`,
      res.status,
    );
  }
  return (text ? JSON.parse(text) : {}) as T;
}

// ── Provision a number ────────────────────────────────────────────────────────────────────────

type AvailableNumbersResponse = {
  available_phone_numbers: { phone_number: string }[];
};

type IncomingPhoneNumberResponse = {
  sid: string;
  phone_number: string;
  voice_url: string;
};

export type ProvisionedNumber = {
  sid: string;
  phoneNumber: string;
};

/**
 * Provision a US local number and point its Voice webhook at our TwiML route. Searches the owner's
 * preferred area code first (best-effort), then buys a number via POST IncomingPhoneNumbers, setting
 * VoiceUrl (the per-owner TwiML endpoint) + StatusCallback (the call-status webhook). Throws
 * TwilioError on any failure — provisioning is owner-initiated and the surface shows the error.
 */
export async function provisionNumber(
  creds: TwilioCreds,
  opts: {
    voiceUrl: string;
    statusCallbackUrl: string;
    areaCode?: string;
  },
): Promise<ProvisionedNumber> {
  const form: Record<string, string> = {
    VoiceUrl: opts.voiceUrl,
    VoiceMethod: "POST",
    StatusCallback: opts.statusCallbackUrl,
    StatusCallbackMethod: "POST",
  };

  // Prefer a specific number from the area-code search so the buy is deterministic; if the search
  // returns nothing (or no area code given), fall back to letting Twilio pick by AreaCode.
  if (opts.areaCode) {
    const search = await twilioForm<AvailableNumbersResponse>(
      creds,
      "GET",
      `${API_VERSION}/Accounts/${creds.accountSid}/AvailablePhoneNumbers/US/Local.json` +
        `?AreaCode=${encodeURIComponent(opts.areaCode)}&VoiceEnabled=true&PageSize=1`,
    );
    const candidate = search.available_phone_numbers[0]?.phone_number;
    if (candidate) form.PhoneNumber = candidate;
    else form.AreaCode = opts.areaCode;
  }

  const bought = await twilioForm<IncomingPhoneNumberResponse>(
    creds,
    "POST",
    `${API_VERSION}/Accounts/${creds.accountSid}/IncomingPhoneNumbers.json`,
    form,
  );
  return { sid: bought.sid, phoneNumber: bought.phone_number };
}

/** Re-point an existing number's Voice + status webhooks (e.g. after the owner reconnects). */
export async function updateVoiceWebhook(
  creds: TwilioCreds,
  numberSid: string,
  opts: { voiceUrl: string; statusCallbackUrl: string },
): Promise<void> {
  await twilioForm(
    creds,
    "POST",
    `${API_VERSION}/Accounts/${creds.accountSid}/IncomingPhoneNumbers/${encodeURIComponent(numberSid)}.json`,
    {
      VoiceUrl: opts.voiceUrl,
      VoiceMethod: "POST",
      StatusCallback: opts.statusCallbackUrl,
      StatusCallbackMethod: "POST",
    },
  );
}

/** End a live call by CallSid (the per-tier cap-hangup path). */
export async function hangup(creds: TwilioCreds, callSid: string): Promise<void> {
  await twilioForm(
    creds,
    "POST",
    `${API_VERSION}/Accounts/${creds.accountSid}/Calls/${encodeURIComponent(callSid)}.json`,
    { Status: "completed" },
  );
}

type CallResponse = { sid: string };

/**
 * Place an outbound test call to the owner's own (SMS-verified) number, playing the TwiML at twimlUrl —
 * the /app/settings/voice test-call button. This is the ONLY outbound path in v0.1 (general outbound
 * ships in v1.5, spec §approval-gate 5); the route guards `to` to the owner's verified number.
 */
export async function placeTestCall(
  creds: TwilioCreds,
  opts: { to: string; from: string; twimlUrl: string; statusCallbackUrl: string },
): Promise<{ callSid: string }> {
  const res = await twilioForm<CallResponse>(
    creds,
    "POST",
    `${API_VERSION}/Accounts/${creds.accountSid}/Calls.json`,
    {
      To: opts.to,
      From: opts.from,
      Url: opts.twimlUrl,
      Method: "POST",
      StatusCallback: opts.statusCallbackUrl,
      StatusCallbackMethod: "POST",
    },
  );
  return { callSid: res.sid };
}

// ── Inbound webhook signature verification (X-Twilio-Signature) ────────────────────────────────

/**
 * Compute Twilio's request signature: HMAC-SHA1, keyed on the Auth Token, over the full request URL
 * concatenated with each POST param's name+value sorted by name. Returns the base64 signature.
 * (Twilio docs: "Validating Signatures from Twilio".) Pure — the route passes the exact public URL it
 * was reached at (proxy-aware) plus the parsed form params.
 */
export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
}

/**
 * Verify the X-Twilio-Signature header against the recomputed signature (constant-time). Reject on a
 * missing header or mismatch (PA-CHAN-4: never accept an unsigned/forged webhook).
 */
export function verifyTwilioSignature(args: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string | null;
}): boolean {
  if (!args.signature) return false;
  const expected = computeTwilioSignature(args.authToken, args.url, args.params);
  const a = Buffer.from(args.signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── TwiML builders ──────────────────────────────────────────────────────────────────────────

/** TwiML that opens a bidirectional Media Stream to our WS endpoint (the answer path). */
export function buildConnectStreamTwiml(streamWssUrl: string): string {
  const safe = escapeXml(streamWssUrl);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<Response><Connect><Stream url="${safe}"/></Connect></Response>`
  );
}

/** TwiML that speaks a message then hangs up (the cap-hangup + error paths). */
export function buildSayHangupTwiml(message: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<Response><Say>${escapeXml(message)}</Say><Hangup/></Response>`
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
