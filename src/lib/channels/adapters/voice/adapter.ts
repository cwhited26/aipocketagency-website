// lib/channels/adapters/voice/adapter.ts — the voice ChannelAdapter (PA-CHAN-15).
//
// Phase 6 v0.1 shipped voice WITHOUT an adapter ("the WS streaming model doesn't fit parseInbound/
// sendOutbound" — types.ts). v2 closes that gap by mapping the contract onto call semantics instead
// of message semantics:
//   • parseInbound  — normalizes a signature-verified Twilio Voice webhook (a ringing call) into a
//     ChannelMessage whose body is the call intent. Like SMS/WhatsApp, the ROUTE owns signature
//     verification (it alone knows the exact public URL the HMAC covers); the adapter exposes the
//     pure classification helpers the route + tests share.
//   • sendOutbound  — "replying" on the voice channel PLACES A CALL: the gateway hands a
//     ChannelResponse whose text is the call purpose and whose channelMeta.to is the destination.
//     The realtime bridge speaks the actual audio once the callee answers.
//
// untrusted_origin=true on every inbound (PA-CHAN-5): a caller is an unauthenticated stranger; the
// realtime session's only side-effect path is the staged-approval gate (session.ts).

import { z } from "zod";
import {
  ChannelSendError,
  type ChannelAdapter,
  type ChannelConnection,
  type ChannelMessage,
  type ChannelResponse,
  type ParseInboundContext,
} from "@/lib/channels/types";
import { placeTestCall, TwilioError, type TwilioCreds } from "@/lib/channels/voice/twilio";
import { twilioEnv } from "@/lib/channels/voice/env";
import { voiceLog } from "@/lib/channels/voice/log";

// ── Inbound webhook shape (Twilio Voice request parameters) ─────────────────────────────────────

export const VoiceWebhookSchema = z
  .object({
    CallSid: z.string().min(1),
    AccountSid: z.string().min(1),
    From: z.string().min(1),
    To: z.string().min(1),
    CallStatus: z.string().optional(),
    Direction: z.string().optional(),
  })
  .passthrough();

export type VoiceWebhookParams = z.infer<typeof VoiceWebhookSchema>;

export type VoiceInboundClassified =
  | { kind: "ignore"; reason: string }
  | { kind: "call"; callSid: string; from: string; to: string };

/**
 * Classify a parsed Voice webhook. Only a fresh ringing/in-progress call becomes a session; every
 * status Twilio might POST to the same URL after the call is live is ignored (the status callback
 * route owns lifecycle updates). Pure — pinned by vitest.
 */
export function classifyVoiceWebhook(params: VoiceWebhookParams): VoiceInboundClassified {
  const status = (params.CallStatus ?? "ringing").toLowerCase();
  if (status !== "ringing" && status !== "in-progress") {
    return { kind: "ignore", reason: `call status '${status}' is not answerable` };
  }
  return { kind: "call", callSid: params.CallSid, from: params.From, to: params.To };
}

/** Decode an application/x-www-form-urlencoded webhook body into the flat param map Twilio signs. */
export function decodeVoiceWebhookBody(rawBody: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rawBody)) params[key] = value;
  return params;
}

/** Build the normalized ChannelMessage for an answered inbound call. */
export function buildVoiceMessage(args: {
  classified: Extract<VoiceInboundClassified, { kind: "call" }>;
  rawPayload: unknown;
}): ChannelMessage {
  return {
    channelSlug: "voice",
    externalId: args.classified.to,
    // A ringing call has no text yet — the realtime bridge produces the transcript. The body
    // records the intent for the pa_channel_messages ledger.
    body: `Inbound call from ${args.classified.from}`,
    threadId: args.classified.callSid,
    untrustedOrigin: true,
    providerMessageId: args.classified.callSid,
    channelMeta: { callSid: args.classified.callSid, from: args.classified.from, to: args.classified.to },
    rawPayload: args.rawPayload,
  };
}

// ── Outbound: place a call ──────────────────────────────────────────────────────────────────────

function credsForConnection(connection: ChannelConnection): TwilioCreds | null {
  const accountSid =
    typeof connection.config.account_sid === "string" && connection.config.account_sid !== ""
      ? connection.config.account_sid
      : null;
  if (accountSid && connection.authToken) {
    return { accountSid, authToken: connection.authToken };
  }
  const env = twilioEnv();
  return env ? { accountSid: env.accountSid, authToken: env.authToken } : null;
}

async function sendOutbound(connection: ChannelConnection, response: ChannelResponse): Promise<void> {
  const to = typeof response.channelMeta.to === "string" ? response.channelMeta.to : "";
  const twimlUrl = typeof response.channelMeta.twimlUrl === "string" ? response.channelMeta.twimlUrl : "";
  const statusCallbackUrl =
    typeof response.channelMeta.statusCallbackUrl === "string"
      ? response.channelMeta.statusCallbackUrl
      : "";
  if (to === "" || twimlUrl === "" || statusCallbackUrl === "") {
    throw new ChannelSendError("voice outbound requires to + twimlUrl + statusCallbackUrl", false);
  }
  const creds = credsForConnection(connection);
  if (!creds) {
    throw new ChannelSendError("voice outbound: no Twilio credentials on connection or env", true);
  }

  try {
    const placed = await placeTestCall(creds, {
      to,
      from: connection.externalId,
      twimlUrl,
      statusCallbackUrl,
    });
    voiceLog.info("voice outbound call placed", { callSid: placed.callSid, ownerId: connection.ownerId });
  } catch (err) {
    if (err instanceof TwilioError) {
      throw new ChannelSendError(err.message, err.status === 401 || err.status === 403);
    }
    throw err;
  }
}

export const voiceAdapter: ChannelAdapter = {
  slug: "voice",
  pairingFlow: "phone_link",
  async parseInbound(ctx: ParseInboundContext): Promise<ChannelMessage | null> {
    // The route owns signature verification (it knows the exact public URL the HMAC covers) and
    // calls the pure helpers above — the SMS/WhatsApp precedent. Nothing routes through here.
    void ctx;
    return null;
  },
  sendOutbound,
};
