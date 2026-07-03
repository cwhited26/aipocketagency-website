// POST /api/channels/inbound/sms — the Channels Gateway SMS webhook (Phase 2, PA-CHAN-1/4/9/10).
//
// Twilio POSTs form-encoded deliveries here (the owner sets this URL as their number's "A message
// comes in" webhook). Not behind the app's auth middleware, so it authenticates itself per
// delivery: X-Twilio-Signature is HMAC-SHA1 over this exact URL + the sorted body params, keyed by
// the pairing's Twilio auth token (PA-CHAN-4 — never trust an unverified body). The sender's
// number resolves which pairing the delivery is for; the signature proves it's really Twilio for
// that account. Only the paired owner number routes — any other sender is ignored with a quiet ack.
//
// APPROVE / EDIT / REJECT (PA-CHAN-9): a bare protocol word from the owner is matched to their
// latest pending Mission Control card instead of dispatching the agent. MMS media is downloaded
// (behind Twilio Basic auth) and parked in Supabase Storage before dispatch.

import { NextRequest, NextResponse } from "next/server";
import { fetchChannelConnectionByExternalId, recordChannelMessage } from "@/lib/channels/store";
import { routeChannelMessage } from "@/lib/channels/gateway";
import { dispatchOutbound } from "@/lib/channels/outbound";
import { channelLog } from "@/lib/channels/log";
import {
  buildSmsMessage,
  parseSmsForm,
  readSmsMedia,
  smsExternalId,
  twilioCredsForConnection,
  SmsWebhookSchema,
} from "@/lib/channels/adapters/sms/adapter";
import { smsChannelInboundUrl } from "@/lib/channels/adapters/sms/connect";
import {
  handleStagedActionReply,
  matchProtocolCommand,
  stagedMissionControlUrl,
} from "@/lib/channels/staged-actions";
import {
  uploadChannelAttachment,
  type StoredChannelAttachment,
} from "@/lib/channels/attachments";
import { verifyTwilioSignature } from "@/lib/connectors/sms/signature";
import { fetchTwilioMedia } from "@/lib/connectors/sms/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio expects TwiML back; an empty <Response/> acks without auto-replying (the real reply goes
// out through the Messages API so long answers can split into ordered segments).
function ack(): NextResponse {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const params = parseSmsForm(rawBody);

  // Structural validation first (cheap, no I/O). A payload without From/To/MessageSid isn't a
  // routable message — ack so Twilio doesn't retry it forever.
  const parsed = SmsWebhookSchema.safeParse(params);
  if (!parsed.success) return ack();
  const inbound = parsed.data;

  // Resolve the pairing by the sender's number. Unknown sender → quiet ack (PA-CHAN-10: only the
  // paired owner number routes; we never echo anything to a stranger).
  const resolved = await fetchChannelConnectionByExternalId("sms", smsExternalId(inbound.From));
  if (!resolved.ok || !resolved.data) return ack();
  const connection = resolved.data;

  // Verify the Twilio signature with THIS pairing's auth token (PA-CHAN-4).
  const creds = twilioCredsForConnection(connection);
  if (!creds) {
    channelLog.warn("sms inbound with no usable Twilio credentials", { connectionId: connection.id });
    return NextResponse.json({ error: "not_verifiable" }, { status: 401 });
  }
  const verified = verifyTwilioSignature({
    authToken: creds.authToken,
    url: smsChannelInboundUrl(),
    params,
    signature: req.headers.get("x-twilio-signature"),
  });
  if (!verified) {
    channelLog.warn("sms inbound signature rejected", { connectionId: connection.id });
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  if (!connection.enabled) return ack();

  const body = (inbound.Body ?? "").trim();

  // APPROVE / EDIT / REJECT — the staged-action text protocol (PA-CHAN-9). Matched before the
  // agent so a protocol word never costs an LLM roundtrip.
  const command = matchProtocolCommand(body);
  if (command) {
    await recordChannelMessage({
      ownerId: connection.ownerId,
      connectionId: connection.id,
      direction: "inbound",
      body,
      threadId: null,
      rawPayload: params,
    });
    const reply = await handleStagedActionReply({
      connection,
      command,
      missionControlUrl: stagedMissionControlUrl(),
    });
    await dispatchOutbound(connection, {
      text: reply.text,
      threadId: null,
      channelMeta: { from: inbound.From, to: inbound.To, surface: "im" },
    });
    await recordChannelMessage({
      ownerId: connection.ownerId,
      connectionId: connection.id,
      direction: "outbound",
      body: reply.text,
      threadId: null,
    });
    return ack();
  }

  // MMS: download each attachment behind Twilio Basic auth and park it in Storage. A failed
  // download is noted honestly rather than silently dropped.
  const media = readSmsMedia(params);
  const stored: StoredChannelAttachment[] = [];
  let failedMedia = 0;
  for (let i = 0; i < media.length; i++) {
    const fetched = await fetchTwilioMedia(
      { accountSid: creds.accountSid, authToken: creds.authToken },
      media[i].url,
      media[i].contentType,
    );
    if (!fetched.ok) {
      failedMedia++;
      channelLog.warn("sms media download failed", {
        connectionId: connection.id,
        status: fetched.status,
      });
      continue;
    }
    const uploaded = await uploadChannelAttachment({
      channelSlug: "sms",
      ownerId: connection.ownerId,
      messageId: inbound.MessageSid,
      index: i,
      contentType: fetched.data.contentType,
      bytes: fetched.data.buffer,
    });
    if (uploaded.ok) stored.push(uploaded.data);
    else failedMedia++;
  }

  const bodyParts = [body];
  if (stored.length > 0) {
    bodyParts.push(`[${stored.length} attachment${stored.length === 1 ? "" : "s"} saved from this text]`);
  }
  if (failedMedia > 0) {
    bodyParts.push(`[${failedMedia} attachment${failedMedia === 1 ? "" : "s"} couldn't be saved]`);
  }
  const composedBody = bodyParts.filter(Boolean).join("\n\n") || "[Empty text message]";

  const message = buildSmsMessage({
    from: inbound.From,
    to: inbound.To,
    body: composedBody,
    messageSid: inbound.MessageSid,
    ...(stored.length > 0 ? { attachments: stored } : {}),
    rawPayload: params,
  });

  // Route through the gateway. Errors are swallowed into the ack so one bad message never wedges
  // the webhook (Twilio would otherwise keep retrying).
  try {
    const outcome = await routeChannelMessage(message);
    channelLog.info("sms inbound routed", { handled: outcome.handled });
  } catch (err) {
    channelLog.error("sms inbound routing threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return ack();
}
