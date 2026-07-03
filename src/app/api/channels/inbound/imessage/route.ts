// POST /api/channels/inbound/imessage — the Channels Gateway iMessage webhook (Phase 3,
// PA-CHAN-1/4/11). The owner's self-hosted BlueBubbles server POSTs { type: 'new-message', … }
// here. Not behind the app's auth middleware, so it authenticates itself per delivery: the
// X-BB-Signature header is HMAC-SHA256 (hex) over the raw body, keyed by the webhook secret the
// owner pasted at connect time (PA-CHAN-4 — never trust an unverified body). The sender handle
// resolves which pairing the delivery is for; only the paired owner handle routes. Our own
// outgoing messages (isFromMe — including the replies we relay) classify as ignore so the bridge
// can't loop on itself.
//
// APPROVE / EDIT / REJECT (PA-CHAN-9): same staged-action text protocol as SMS.

import { NextRequest, NextResponse } from "next/server";
import { decrypt, DecryptionError } from "@/lib/crypto/encrypt";
import { fetchChannelConnectionByExternalId, recordChannelMessage } from "@/lib/channels/store";
import { routeChannelMessage } from "@/lib/channels/gateway";
import { dispatchOutbound } from "@/lib/channels/outbound";
import { channelLog } from "@/lib/channels/log";
import type { ChannelConnection } from "@/lib/channels/types";
import {
  buildImessageMessage,
  classifyBlueBubblesPayload,
  imessageExternalId,
} from "@/lib/channels/adapters/imessage/adapter";
import {
  BB_SIGNATURE_HEADER,
  verifyBlueBubblesSignature,
} from "@/lib/channels/adapters/imessage/signing";
import { IMESSAGE_WEBHOOK_SECRET_CONFIG_KEY } from "@/lib/channels/adapters/imessage/connect";
import {
  handleStagedActionReply,
  matchProtocolCommand,
  stagedMissionControlUrl,
} from "@/lib/channels/staged-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ack(): NextResponse {
  return NextResponse.json({ ok: true });
}

// The connection's saved webhook secret (encrypted in config), else the env fallback for the
// single-relay self-host default. A missing/un-decryptable secret means we can't verify.
function connectionSecret(connection: ChannelConnection): string | null {
  const enc = connection.config[IMESSAGE_WEBHOOK_SECRET_CONFIG_KEY];
  if (typeof enc === "string") {
    try {
      return decrypt(enc);
    } catch (err) {
      if (err instanceof DecryptionError) return null;
      throw err;
    }
  }
  return process.env.PA_BLUEBUBBLES_WEBHOOK_SECRET ?? null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  // Structural classify first (cheap, no I/O) — non-message events, our own outgoing messages,
  // and unparseable payloads never hit the DB.
  const inbound = classifyBlueBubblesPayload(rawBody);
  if (inbound.kind === "ignore") return ack();

  // Resolve the pairing by the sender's handle. Unknown handle → quiet ack (only the paired owner
  // handle routes; a group chat's other members never reach the agent).
  const resolved = await fetchChannelConnectionByExternalId(
    "imessage",
    imessageExternalId(inbound.handle),
  );
  if (!resolved.ok || !resolved.data) return ack();
  const connection = resolved.data;

  // Verify X-BB-Signature with THIS pairing's webhook secret (PA-CHAN-4).
  const secret = connectionSecret(connection);
  if (!secret) return NextResponse.json({ error: "not_verifiable" }, { status: 401 });
  const verified = verifyBlueBubblesSignature({
    secret,
    rawBody,
    signature: req.headers.get(BB_SIGNATURE_HEADER),
  });
  if (!verified) {
    channelLog.warn("imessage inbound signature rejected", { connectionId: connection.id });
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  if (!connection.enabled) return ack();

  // APPROVE / EDIT / REJECT — the staged-action text protocol (PA-CHAN-9).
  const command = matchProtocolCommand(inbound.text);
  if (command) {
    await recordChannelMessage({
      ownerId: connection.ownerId,
      connectionId: connection.id,
      direction: "inbound",
      body: inbound.text,
      threadId: inbound.chatGuid,
      rawPayload: JSON.parse(rawBody) as unknown,
    });
    const reply = await handleStagedActionReply({
      connection,
      command,
      missionControlUrl: stagedMissionControlUrl(),
    });
    await dispatchOutbound(connection, {
      text: reply.text,
      threadId: inbound.chatGuid,
      channelMeta: { chatGuid: inbound.chatGuid, surface: "im" },
    });
    await recordChannelMessage({
      ownerId: connection.ownerId,
      connectionId: connection.id,
      direction: "outbound",
      body: reply.text,
      threadId: inbound.chatGuid,
    });
    return ack();
  }

  const message = buildImessageMessage({
    handle: inbound.handle,
    chatGuid: inbound.chatGuid,
    guid: inbound.guid,
    text: inbound.text,
    rawPayload: JSON.parse(rawBody) as unknown,
  });

  // Route through the gateway. Errors are swallowed into the ack so one bad message never wedges
  // the webhook.
  try {
    const outcome = await routeChannelMessage(message);
    channelLog.info("imessage inbound routed", { handled: outcome.handled });
  } catch (err) {
    channelLog.error("imessage inbound routing threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return ack();
}
