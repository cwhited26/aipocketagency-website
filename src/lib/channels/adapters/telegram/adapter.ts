// lib/channels/adapters/telegram/adapter.ts — the Telegram ChannelAdapter (Channels Gateway Phase 2,
// PA-CHAN-1).
//
// Inbound: the per-connection secret-token verification (signing.ts) and the file-download enrichment
// (enrich.ts) both need state the bare ParseInboundContext doesn't carry — the connection's saved
// secret and bot token — so the webhook route drives those steps and hands the gateway a finished
// ChannelMessage. parseInbound here implements the contract for the text-only case (structural parse,
// no I/O) and is what the registry exposes; the rich voice/document path lives in the route.
//
// Outbound: sendMessage with the reply text plus an inline URL keyboard that deep-links into Mission
// Control (PA-CHAN-6 — no external action fires from the channel this phase; the owner taps through
// and approves in the web app). Direct REST to api.telegram.org (api.ts) — no SDK.

import {
  ChannelSendError,
  type ChannelAdapter,
  type ChannelConnection,
  type ChannelMessage,
  type ChannelResponse,
  type ParseInboundContext,
} from "@/lib/channels/types";
import { channelLog } from "@/lib/channels/log";
import { telegramSendMessage } from "./api";
import { classifyTelegramUpdate, type TelegramInboundClassified } from "./types";

// Telegram's externalId namespace: the bot id the delivery is for. The owner resolves by
// (telegram, tg:<botId>) — one bot per owner connection (Bot API: a token serves one bot).
export function telegramExternalId(botId: string): string {
  return `tg:${botId}`;
}

// Telegram messages cap at 4096 chars; clip defensively (we send plain text, no parse_mode, so the
// agent's markdown renders literally rather than risking a 400 on malformed entities).
export const TELEGRAM_TEXT_LIMIT = 4096;
function clip(text: string, max = TELEGRAM_TEXT_LIMIT): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/**
 * Build the normalized ChannelMessage for a classified TEXT inbound. Voice/document inbounds are
 * enriched (transcribed / parsed) in the route before this body is known, then passed through
 * buildTelegramMessage with the resolved text — so this one builder serves every content kind.
 */
export function buildTelegramMessage(args: {
  botId: string;
  chatId: number;
  messageId: number;
  updateId: number;
  body: string;
  rawPayload: unknown;
}): ChannelMessage {
  return {
    channelSlug: "telegram",
    externalId: telegramExternalId(args.botId),
    body: args.body,
    // Reply in-place: Telegram threads a reply via reply_to_message_id; we carry the message id.
    threadId: String(args.messageId),
    // PA-CHAN-5: every channel message is untrusted inbound content.
    untrustedOrigin: true,
    // A provider-stable id so the inbound roundtrip's cost meters idempotently across a Telegram
    // redelivery (Telegram resends the same update_id if the ack is slow).
    providerMessageId: `${args.botId}:${args.updateId}`,
    channelMeta: { chatId: args.chatId, messageId: args.messageId, surface: "im" },
    rawPayload: args.rawPayload,
  };
}

/** Classify a raw webhook body for a given bot. The route uses this, then verifies + enriches. */
export function readTelegramInbound(rawBody: string, botId: string): TelegramInboundClassified {
  return classifyTelegramUpdate(rawBody, botId);
}

// ── Outbound ──────────────────────────────────────────────────────────────────────────────────

function readChannelMeta(meta: Record<string, unknown>): { chatId: number | string | null; messageId: number | null } {
  const chatId =
    typeof meta.chatId === "number" || typeof meta.chatId === "string" ? meta.chatId : null;
  const messageId = typeof meta.messageId === "number" ? meta.messageId : null;
  return { chatId, messageId };
}

// Map the gateway's channel-agnostic buttons onto a Telegram inline URL keyboard (one button per row).
function buildReplyMarkup(response: ChannelResponse): Record<string, unknown> | undefined {
  if (!response.buttons || response.buttons.length === 0) return undefined;
  return {
    inline_keyboard: response.buttons.slice(0, 5).map((b) => [{ text: clip(b.label, 64), url: b.url }]),
  };
}

async function sendOutbound(connection: ChannelConnection, response: ChannelResponse): Promise<void> {
  if (!connection.authToken) {
    throw new ChannelSendError("no_token", true);
  }
  const { chatId, messageId } = readChannelMeta(response.channelMeta);
  if (chatId === null) {
    throw new ChannelSendError("no_chat", false);
  }

  const res = await telegramSendMessage(connection.authToken, {
    chat_id: chatId,
    text: clip(response.text),
    ...(messageId !== null ? { reply_to_message_id: messageId } : {}),
    ...(buildReplyMarkup(response) ? { reply_markup: buildReplyMarkup(response) } : {}),
  });
  if (!res.ok) {
    channelLog.error("telegram sendMessage failed", {
      connectionId: connection.id,
      status: res.status,
      authError: res.authError,
    });
    throw new ChannelSendError(res.error, res.authError);
  }
}

export const telegramAdapter: ChannelAdapter = {
  slug: "telegram",
  pairingFlow: "bot_token",
  async parseInbound(ctx: ParseInboundContext): Promise<ChannelMessage | null> {
    // The contract's pure path: structural text parse only. The route owns the secret check + the
    // voice/document enrichment (both need the connection's secret + bot token, which ctx lacks).
    // botId is unknown to the bare context, so a text-only parse can't resolve the externalId here;
    // the route is the real inbound entry. Returning null keeps the registry/outbound seam honest.
    void ctx;
    return null;
  },
  sendOutbound,
};
