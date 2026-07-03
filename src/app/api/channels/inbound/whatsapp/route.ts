// /api/channels/inbound/whatsapp — the Channels Gateway WhatsApp webhook (Phase 4,
// PA-CHAN-1/4/12).
//
// GET: Meta's subscription handshake — echo hub.challenge when hub.verify_token matches the
// platform WHATSAPP_VERIFY_TOKEN (the owner enters that token in their Meta app's webhook config).
//
// POST: Meta delivers the entry/changes/value envelope. Not behind the app's auth middleware, so
// it authenticates itself per delivery: X-Hub-Signature-256 is HMAC-SHA256 over the raw body,
// keyed by the pairing's app secret (PA-CHAN-4 — never trust an unverified body). The envelope's
// phone_number_id resolves which pairing the delivery is for; only the paired owner number routes
// (PA-CHAN-12 — a customer texting the business number never reaches the agent).
//
// APPROVE / EDIT / REJECT (PA-CHAN-9): a native reply-button tap (interactive.button_reply with id
// approve/edit/reject) or a bare typed protocol word resolves the owner's latest pending card.
//
// COLD ONBOARDING (PA-POS-32 §22): a delivery whose phone_number_id has NO pairing but matches
// the PA public number env routes to the cold-onboarding handler — after its own signature
// check against the env WHATSAPP_APP_SECRET. A paired connection always wins the lookup, so an
// existing customer's private pairing can never fall into the cold path (§22.4 number cap).

import { NextRequest, NextResponse } from "next/server";
import { decrypt, DecryptionError } from "@/lib/crypto/encrypt";
import { fetchChannelConnectionByExternalId, recordChannelMessage } from "@/lib/channels/store";
import { routeChannelMessage } from "@/lib/channels/gateway";
import { dispatchOutbound } from "@/lib/channels/outbound";
import { channelLog } from "@/lib/channels/log";
import type { ChannelConnection } from "@/lib/channels/types";
import {
  buildWhatsappMessage,
  classifyWhatsappPayload,
  normalizeWhatsappNumber,
  whatsappExternalId,
} from "@/lib/channels/adapters/whatsapp/adapter";
import {
  HUB_SIGNATURE_HEADER,
  verifyHubSignature,
} from "@/lib/channels/adapters/whatsapp/signing";
import { WHATSAPP_APP_SECRET_CONFIG_KEY } from "@/lib/channels/adapters/whatsapp/connect";
import {
  handleStagedActionReply,
  matchProtocolCommand,
  stagedMissionControlUrl,
} from "@/lib/channels/staged-actions";
import { coldWhatsappConfig, isColdInboundNumber } from "@/lib/onboarding/whatsapp-cold/config";
import { handleColdWhatsappInbound } from "@/lib/onboarding/whatsapp-cold/handler";
import { coldLog } from "@/lib/onboarding/whatsapp-cold/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ack(): NextResponse {
  return NextResponse.json({ ok: true });
}

// ── GET: Meta's hub.challenge verification handshake ───────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode !== "subscribe" || !expected || token !== expected || !challenge) {
    return NextResponse.json({ error: "verification_failed" }, { status: 403 });
  }
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

// ── POST: inbound deliveries ────────────────────────────────────────────────────────────────────

// The connection's saved app secret (encrypted in config), else the env fallback.
function connectionAppSecret(connection: ChannelConnection): string | null {
  const enc = connection.config[WHATSAPP_APP_SECRET_CONFIG_KEY];
  if (typeof enc === "string") {
    try {
      return decrypt(enc);
    } catch (err) {
      if (err instanceof DecryptionError) return null;
      throw err;
    }
  }
  return process.env.WHATSAPP_APP_SECRET ?? null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  // Structural classify first (cheap, no I/O) — status-only deliveries and unparseable payloads
  // never hit the DB.
  const inbound = classifyWhatsappPayload(rawBody);
  if (inbound.kind === "ignore") return ack();

  // Resolve the pairing by the Business number's Phone Number ID.
  const resolved = await fetchChannelConnectionByExternalId(
    "whatsapp",
    whatsappExternalId(inbound.phoneNumberId),
  );
  if (!resolved.ok || !resolved.data) {
    // Unknown sender path (PA-POS-32): no pairing owns this number. If it's the PA public
    // number, verify the signature with the platform app secret and hand the message to the
    // cold-onboarding handler. Anything else stays a quiet ack (unchanged Phase 4 behavior).
    const cold = coldWhatsappConfig();
    if (!cold || !isColdInboundNumber(inbound.phoneNumberId, cold)) return ack();

    const coldVerified = verifyHubSignature({
      appSecret: cold.appSecret,
      rawBody,
      signature: req.headers.get(HUB_SIGNATURE_HEADER),
    });
    if (!coldVerified) {
      coldLog.warn("cold inbound signature rejected");
      return NextResponse.json({ error: "bad_signature" }, { status: 401 });
    }

    // Errors are swallowed into the ack — Meta retries aggressively on non-200s.
    try {
      const outcome = await handleColdWhatsappInbound({
        from: inbound.from,
        text: inbound.text,
        messageId: inbound.messageId,
      });
      coldLog.info("cold inbound handled", { handled: outcome.handled });
    } catch (err) {
      coldLog.error("cold inbound handler threw", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return ack();
  }
  const connection = resolved.data;

  // Verify X-Hub-Signature-256 with THIS pairing's app secret (PA-CHAN-4).
  const appSecret = connectionAppSecret(connection);
  if (!appSecret) return NextResponse.json({ error: "not_verifiable" }, { status: 401 });
  const verified = verifyHubSignature({
    appSecret,
    rawBody,
    signature: req.headers.get(HUB_SIGNATURE_HEADER),
  });
  if (!verified) {
    channelLog.warn("whatsapp inbound signature rejected", { connectionId: connection.id });
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  if (!connection.enabled) return ack();

  // Only the paired owner number routes (PA-CHAN-12). Anyone else texting the business number is
  // quietly ignored — the agent never answers a customer directly.
  const ownerNumber =
    typeof connection.config.ownerNumber === "string"
      ? normalizeWhatsappNumber(connection.config.ownerNumber)
      : "";
  if (!ownerNumber || normalizeWhatsappNumber(inbound.from) !== ownerNumber) {
    channelLog.info("whatsapp inbound from non-owner sender — ignored", {
      connectionId: connection.id,
    });
    return ack();
  }

  // APPROVE / EDIT / REJECT — a native button tap, or the typed text protocol (PA-CHAN-9).
  const command = inbound.buttonCommand ?? matchProtocolCommand(inbound.text);
  if (command) {
    await recordChannelMessage({
      ownerId: connection.ownerId,
      connectionId: connection.id,
      direction: "inbound",
      body: inbound.text,
      threadId: null,
      rawPayload: JSON.parse(rawBody) as unknown,
    });
    const reply = await handleStagedActionReply({
      connection,
      command,
      missionControlUrl: stagedMissionControlUrl(),
    });
    await dispatchOutbound(connection, {
      text: reply.text,
      threadId: null,
      channelMeta: { from: inbound.from, phoneNumberId: inbound.phoneNumberId, surface: "im" },
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

  const message = buildWhatsappMessage({
    phoneNumberId: inbound.phoneNumberId,
    from: inbound.from,
    messageId: inbound.messageId,
    text: inbound.text,
    rawPayload: JSON.parse(rawBody) as unknown,
  });

  // Route through the gateway. Errors are swallowed into the ack so one bad message never wedges
  // the webhook (Meta retries aggressively on non-200s).
  try {
    const outcome = await routeChannelMessage(message);
    channelLog.info("whatsapp inbound routed", { handled: outcome.handled });
  } catch (err) {
    channelLog.error("whatsapp inbound routing threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return ack();
}
