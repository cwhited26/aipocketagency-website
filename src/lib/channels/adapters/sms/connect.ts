// lib/channels/adapters/sms/connect.ts — the SMS pairing orchestration (Channels Gateway Phase 2,
// PA-CHAN-9/10). No OAuth: the owner pastes their Twilio Account SID + auth token, the number (or
// Messaging Service) their agent texts FROM, and their own cell number (the only sender that
// routes). Connecting is two steps, direct REST:
//   1. GET /2010-04-01/Accounts/{sid}.json — validate the SID+token pair against Twilio.
//   2. upsert — auth token encrypted in auth_token_encrypted; SIDs + numbers in config.
// The owner then points their Twilio number's "A message comes in" webhook at smsChannelInboundUrl()
// (shown on the settings card) — we don't rewrite their number config behind their back.

import { upsertChannelConnection } from "@/lib/channels/store";
import { smsExternalId } from "./adapter";

const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

/** The shared inbound webhook the owner sets as their Twilio number's SmsUrl. This exact string is
 *  also what the signature verifier signs over, so the two can never drift. */
export function smsChannelInboundUrl(): string {
  const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(/\/+$/, "");
  return `${base}/api/channels/inbound/sms`;
}

// E.164, permissively: + then 8–15 digits.
export function isE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export type SmsConnectResult =
  | { ok: true; ownerPhone: string }
  | { ok: false; status: number; error: string };

/**
 * Validate + store an owner's Twilio pairing. A bad SID/token pair, a malformed number, or a store
 * failure all surface as a typed error the route maps to copy.
 */
export async function connectSmsChannel(args: {
  ownerId: string;
  accountSid: string;
  authToken: string;
  ownerPhone: string;
  fromNumber?: string;
  messagingServiceSid?: string;
}): Promise<SmsConnectResult> {
  const accountSid = args.accountSid.trim();
  const authToken = args.authToken.trim();
  const ownerPhone = args.ownerPhone.trim();
  const fromNumber = args.fromNumber?.trim() ?? "";
  const messagingServiceSid = args.messagingServiceSid?.trim() ?? "";

  if (!/^AC[a-zA-Z0-9]{32}$/.test(accountSid)) return { ok: false, status: 400, error: "invalid_sid" };
  if (!authToken) return { ok: false, status: 400, error: "missing_token" };
  if (!isE164(ownerPhone)) return { ok: false, status: 400, error: "invalid_owner_phone" };
  if (!fromNumber && !messagingServiceSid) return { ok: false, status: 400, error: "missing_sender" };
  if (fromNumber && !isE164(fromNumber)) return { ok: false, status: 400, error: "invalid_from_number" };
  if (messagingServiceSid && !/^MG[a-zA-Z0-9]{32}$/.test(messagingServiceSid)) {
    return { ok: false, status: 400, error: "invalid_messaging_service" };
  }

  // 1. Validate the credential pair against Twilio (a plain account read; no side effects).
  let accountRes: Response;
  try {
    accountRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, error: "twilio_unreachable" };
  }
  if (accountRes.status === 401 || accountRes.status === 403) {
    return { ok: false, status: 401, error: "invalid_credentials" };
  }
  if (!accountRes.ok) return { ok: false, status: 502, error: "twilio_error" };

  // 2. Persist (auth token encrypted by the store; SIDs + numbers as per-channel config).
  const result = await upsertChannelConnection({
    ownerId: args.ownerId,
    channelSlug: "sms",
    externalId: smsExternalId(ownerPhone),
    authToken,
    config: {
      accountSid,
      ownerPhone,
      ...(fromNumber ? { fromNumber } : {}),
      ...(messagingServiceSid ? { messagingServiceSid } : {}),
    },
  });
  if (!result.ok) return { ok: false, status: result.status, error: "store_failed" };

  return { ok: true, ownerPhone };
}
