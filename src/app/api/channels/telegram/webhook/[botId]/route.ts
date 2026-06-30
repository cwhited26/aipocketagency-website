// POST /api/channels/telegram/webhook/[botId] — the Channels Gateway Telegram webhook (Phase 2,
// PA-CHAN-1/4).
//
// Not behind the app's auth middleware (the matcher covers /app + /api/app only), so it authenticates
// itself per delivery: Telegram echoes the per-connection secret token in the
// X-Telegram-Bot-Api-Secret-Token header, and we constant-time compare it to the owner's saved secret
// (PA-CHAN-4 — never trust an unverified body). The botId in the path resolves which owner+bot the
// delivery is for; the secret proves it's really Telegram. After verification, a text message is
// dispatched straight through the gateway; a voice note or document is downloaded + transcribed/parsed
// (using the bot token) into a text body first.
//
// Redelivery: Telegram has no retry-num header — it resends the same update_id if our ack is slow.
// The agent turn runs inline (Next 14 has no after()), so a >~60s turn could see a duplicate delivery;
// the inbound roundtrip's cost is anchored on update_id (gateway), so a redelivery never double-bills.
// We ack 200 on every handled/ignored case so Telegram stops retrying.

import { NextRequest, NextResponse } from "next/server";
import { decrypt, DecryptionError } from "@/lib/crypto/encrypt";
import { fetchChannelConnectionByExternalId } from "@/lib/channels/store";
import { routeChannelMessage } from "@/lib/channels/gateway";
import { dispatchOutbound } from "@/lib/channels/outbound";
import { channelLog } from "@/lib/channels/log";
import type { ChannelConnection } from "@/lib/channels/types";
import {
  readTelegramInbound,
  buildTelegramMessage,
  telegramExternalId,
} from "@/lib/channels/adapters/telegram/adapter";
import {
  verifyTelegramSecret,
  TELEGRAM_SECRET_HEADER,
} from "@/lib/channels/adapters/telegram/signing";
import { TELEGRAM_WEBHOOK_SECRET_CONFIG_KEY } from "@/lib/channels/adapters/telegram/connect";
import { enrichVoice, enrichDocument } from "@/lib/channels/adapters/telegram/enrich";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ack(): NextResponse {
  return NextResponse.json({ ok: true });
}

// Decrypt the connection's saved webhook secret (stored encrypted in config). A missing or
// un-decryptable secret means we can't verify → treat as unverifiable.
function connectionSecret(connection: ChannelConnection): string | null {
  const enc = connection.config[TELEGRAM_WEBHOOK_SECRET_CONFIG_KEY];
  if (typeof enc !== "string") return null;
  try {
    return decrypt(enc);
  } catch (err) {
    if (err instanceof DecryptionError) return null;
    throw err;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { botId: string } },
): Promise<NextResponse> {
  const botId = params.botId;
  const rawBody = await req.text();

  // Structural classify first (cheap, no I/O) so an obviously-uninteresting update never hits the DB.
  const inbound = readTelegramInbound(rawBody, botId);
  if (inbound.kind === "ignore") return ack();

  // Resolve the owner by (telegram, tg:<botId>). Unknown bot → unverifiable → 401.
  const resolved = await fetchChannelConnectionByExternalId("telegram", telegramExternalId(botId));
  if (!resolved.ok || !resolved.data) {
    return NextResponse.json({ error: "unknown_bot" }, { status: 401 });
  }
  const connection = resolved.data;

  // Verify the secret-token header against the connection's saved secret (PA-CHAN-4).
  const secret = connectionSecret(connection);
  if (!secret) return NextResponse.json({ error: "not_verifiable" }, { status: 401 });
  const check = verifyTelegramSecret({
    expectedSecret: secret,
    headerSecret: req.headers.get(TELEGRAM_SECRET_HEADER),
  });
  if (!check.ok) {
    channelLog.warn("telegram inbound secret rejected", { reason: check.reason });
    return NextResponse.json({ error: `secret_${check.reason}` }, { status: 401 });
  }

  if (!connection.enabled) return ack();

  // Resolve the body. Text dispatches as-is; voice/document are downloaded + interpreted first.
  let body: string;
  if (inbound.kind === "text") {
    body = inbound.text;
  } else {
    if (!connection.authToken) {
      // Token won't decrypt (rotated key / revoked) — can't download the attachment or reply.
      channelLog.warn("telegram attachment inbound with no usable token", { connectionId: connection.id });
      return ack();
    }
    const enriched =
      inbound.kind === "voice"
        ? await enrichVoice({ botToken: connection.authToken, caption: inbound.caption, file: inbound.file })
        : await enrichDocument({ botToken: connection.authToken, caption: inbound.caption, file: inbound.file });
    if (!enriched.ok) {
      // Soft failure (couldn't transcribe / unsupported file): reply with the honest note, no LLM.
      await dispatchOutbound(connection, {
        text: enriched.note,
        threadId: String(inbound.messageId),
        channelMeta: { chatId: inbound.chatId, messageId: inbound.messageId, surface: "im" },
      });
      return ack();
    }
    body = enriched.body;
  }

  const message = buildTelegramMessage({
    botId,
    chatId: inbound.chatId,
    messageId: inbound.messageId,
    updateId: inbound.updateId,
    body,
    rawPayload: JSON.parse(rawBody) as unknown,
  });

  // Run it through the gateway. Errors are swallowed into the ack so one bad message never wedges the
  // webhook (Telegram would otherwise keep redelivering).
  try {
    const outcome = await routeChannelMessage(message);
    channelLog.info("telegram inbound routed", { handled: outcome.handled, kind: inbound.kind });
  } catch (err) {
    channelLog.error("telegram inbound routing threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return ack();
}
