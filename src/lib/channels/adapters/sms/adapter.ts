// lib/channels/adapters/sms/adapter.ts — the SMS ChannelAdapter (Channels Gateway Phase 2 of the
// SPEC's channel ladder, PA-CHAN-1/9/10). Twilio, direct REST — no SDK.
//
// Inbound: Twilio POSTs application/x-www-form-urlencoded to /api/channels/inbound/sms. The
// signature scheme (HMAC-SHA1 over the exact webhook URL + sorted body params, keyed by the
// account's auth token — connectors/sms/signature.ts) needs the CONNECTION's auth token, which the
// bare ParseInboundContext doesn't carry — so the route resolves the connection by the sender's
// number first, verifies, then hands the gateway a finished ChannelMessage via buildSmsMessage.
// parseInbound on the registry adapter returns null for the same reason Telegram's does: the route
// is the real inbound entry.
//
// Outbound: POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json with either
// the connection's own pasted-in Twilio creds (auth_token_encrypted + config.accountSid) or the
// platform env pair as the fallback. MessagingServiceSid wins over a bare From number when set.
// SMS renders no buttons — a staged reply gets the APPROVE / EDIT / REJECT text protocol footer,
// and URL buttons flatten to "label: url" lines.

import { z } from "zod";
import {
  ChannelSendError,
  type ChannelAdapter,
  type ChannelConnection,
  type ChannelMessage,
  type ChannelResponse,
  type ParseInboundContext,
} from "@/lib/channels/types";
import { channelLog } from "@/lib/channels/log";
import { STAGED_PROTOCOL_FOOTER } from "@/lib/channels/staged-actions";
import type { StoredChannelAttachment } from "@/lib/channels/attachments";
import { splitSmsSegments } from "@/lib/connectors/sms/send";
import { twilioConfig } from "@/lib/connectors/sms/config";

// The SMS externalId namespace: the OWNER's phone number (E.164) — the From on every inbound. The
// gateway resolves by (sms, sms:<E.164>); only the paired owner number routes (PA-CHAN-10).
export function smsExternalId(ownerPhone: string): string {
  return `sms:${ownerPhone.trim()}`;
}

// ── Inbound parsing (pure) ────────────────────────────────────────────────────────────────────

/** Decode a Twilio form-encoded webhook body into a flat param record (signature input shape). */
export function parseSmsForm(rawBody: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rawBody)) params[key] = value;
  return params;
}

// Zod at the webhook boundary: the fields that make a Twilio delivery a routable inbound message.
export const SmsWebhookSchema = z
  .object({
    From: z.string().min(1),
    To: z.string().min(1),
    MessageSid: z.string().min(1),
    Body: z.string().optional(),
    NumMedia: z.string().optional(),
    AccountSid: z.string().optional(),
  })
  .passthrough();
export type SmsWebhookBody = z.infer<typeof SmsWebhookSchema>;

// An MMS attachment as Twilio describes it (MediaUrl0..N + MediaContentType0..N).
export type SmsInboundMedia = { url: string; contentType: string };

/** Pull the MediaUrl{i} / MediaContentType{i} pairs off a validated webhook body. */
export function readSmsMedia(params: Record<string, string>): SmsInboundMedia[] {
  const numMedia = Number.parseInt(params.NumMedia ?? "0", 10);
  if (!Number.isFinite(numMedia) || numMedia <= 0) return [];
  const media: SmsInboundMedia[] = [];
  for (let i = 0; i < numMedia; i++) {
    const url = params[`MediaUrl${i}`]?.trim();
    const contentType = params[`MediaContentType${i}`]?.trim();
    if (url && contentType) media.push({ url, contentType });
  }
  return media;
}

/** Build the normalized ChannelMessage for a verified SMS inbound. */
export function buildSmsMessage(args: {
  from: string;
  to: string;
  body: string;
  messageSid: string;
  attachments?: StoredChannelAttachment[];
  rawPayload: unknown;
}): ChannelMessage {
  return {
    channelSlug: "sms",
    externalId: smsExternalId(args.from),
    body: args.body,
    // SMS has no threads; the conversation is the number pair.
    threadId: null,
    // PA-CHAN-5: every channel message is untrusted inbound content.
    untrustedOrigin: true,
    // Twilio's MessageSid is provider-stable — anchors cost idempotency across a webhook retry.
    providerMessageId: args.messageSid,
    channelMeta: { from: args.from, to: args.to, surface: "im" },
    ...(args.attachments && args.attachments.length > 0 ? { attachments: args.attachments } : {}),
    rawPayload: args.rawPayload,
  };
}

// ── Credentials (per-connection paste-in, env fallback) ─────────────────────────────────────────

export type TwilioSendCreds = {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string | null;
  fromNumber: string | null;
};

/**
 * The Twilio credentials this connection sends (and verifies) with: the owner's pasted-in pair
 * when present (config.accountSid + the decrypted auth token), else the platform env pair. Returns
 * null when neither is configured.
 */
export function twilioCredsForConnection(connection: ChannelConnection): TwilioSendCreds | null {
  const cfgAccountSid =
    typeof connection.config.accountSid === "string" ? connection.config.accountSid : null;
  const cfgMessagingServiceSid =
    typeof connection.config.messagingServiceSid === "string" && connection.config.messagingServiceSid
      ? connection.config.messagingServiceSid
      : null;
  const cfgFromNumber =
    typeof connection.config.fromNumber === "string" && connection.config.fromNumber
      ? connection.config.fromNumber
      : null;

  if (cfgAccountSid && connection.authToken) {
    return {
      accountSid: cfgAccountSid,
      authToken: connection.authToken,
      messagingServiceSid: cfgMessagingServiceSid,
      fromNumber: cfgFromNumber,
    };
  }

  const env = twilioConfig();
  if (!env) return null;
  return {
    accountSid: env.accountSid,
    authToken: env.authToken,
    messagingServiceSid:
      cfgMessagingServiceSid ?? process.env.TWILIO_MESSAGING_SERVICE_SID ?? null,
    fromNumber: cfgFromNumber ?? process.env.TWILIO_FROM_NUMBER ?? null,
  };
}

// ── Outbound rendering + send ───────────────────────────────────────────────────────────────────

/** Flatten a ChannelResponse into plain SMS text: buttons become "label: url" lines; a staged
 *  reply appends the APPROVE / EDIT / REJECT protocol footer. Exported for tests. */
export function renderSmsText(response: ChannelResponse): string {
  const parts = [response.text.trim()];
  if (response.staged) {
    parts.push(STAGED_PROTOCOL_FOOTER);
  } else if (response.buttons && response.buttons.length > 0) {
    parts.push(response.buttons.map((b) => `${b.label.replace(/\s*→\s*$/, "")}: ${b.url}`).join("\n"));
  }
  return parts.filter(Boolean).join("\n\n");
}

async function sendOutbound(connection: ChannelConnection, response: ChannelResponse): Promise<void> {
  const creds = twilioCredsForConnection(connection);
  if (!creds) throw new ChannelSendError("twilio_not_configured", true);
  if (!creds.messagingServiceSid && !creds.fromNumber) {
    throw new ChannelSendError("no_sender_number", true);
  }

  const metaFrom = connection.config.ownerPhone ?? response.channelMeta.from;
  const to =
    typeof metaFrom === "string" && metaFrom
      ? metaFrom
      : connection.externalId.replace(/^sms:/, "");
  if (!to) throw new ChannelSendError("no_recipient", false);

  const segments = splitSmsSegments(renderSmsText(response));
  if (segments.length === 0) throw new ChannelSendError("empty_reply", false);

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
  const auth = `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64")}`;

  for (const segment of segments) {
    const form = new URLSearchParams({ To: to, Body: segment });
    if (creds.messagingServiceSid) form.set("MessagingServiceSid", creds.messagingServiceSid);
    else if (creds.fromNumber) form.set("From", creds.fromNumber);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      channelLog.error("twilio send failed", {
        connectionId: connection.id,
        status: res.status,
      });
      // 401/403 = dead credentials → flip the connection to reconnect; anything else is transient.
      throw new ChannelSendError(
        `twilio_send_${res.status}: ${body.slice(0, 200)}`,
        res.status === 401 || res.status === 403,
      );
    }
  }
}

export const smsAdapter: ChannelAdapter = {
  slug: "sms",
  pairingFlow: "phone_link",
  async parseInbound(ctx: ParseInboundContext): Promise<ChannelMessage | null> {
    // The route owns the real inbound path: signature verification needs the connection's Twilio
    // auth token (resolved by the sender's number), which the bare context doesn't carry — the
    // same route-driven pattern as the Telegram adapter.
    void ctx;
    return null;
  },
  sendOutbound,
};
