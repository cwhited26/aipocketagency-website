// lib/channels/adapters/telegram/types.ts — Zod schemas for the Telegram inbound payload and the
// structural classifier that reduces an Update to "what content did the owner send" (PA-CHAN-1).
//
// Pure + no I/O: this validates the webhook body and classifies it into text / voice / document /
// ignore. File download + transcription + document parsing happen later (enrich.ts) because they
// need the bot token, which the structural parse never sees. Splitting the two keeps this layer unit
// testable against a fixture body with no network.

import { z } from "zod";

// ── Telegram Update schemas (only the fields the gateway reads; Telegram sends many more) ─────────

const TelegramChatSchema = z.object({
  id: z.number(),
  // 'private' = a DM to the bot; 'group' | 'supergroup' | 'channel' are multi-party.
  type: z.string(),
});

const TelegramUserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean().optional(),
  username: z.string().optional(),
  first_name: z.string().optional(),
});

const TelegramVoiceSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  duration: z.number().optional(),
  mime_type: z.string().optional(),
  file_size: z.number().optional(),
});

const TelegramAudioSchema = TelegramVoiceSchema.extend({
  file_name: z.string().optional(),
});

const TelegramDocumentSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  file_name: z.string().optional(),
  mime_type: z.string().optional(),
  file_size: z.number().optional(),
});

const TelegramMessageSchema = z.object({
  message_id: z.number(),
  from: TelegramUserSchema.optional(),
  chat: TelegramChatSchema,
  date: z.number().optional(),
  text: z.string().optional(),
  caption: z.string().optional(),
  voice: TelegramVoiceSchema.optional(),
  audio: TelegramAudioSchema.optional(),
  document: TelegramDocumentSchema.optional(),
});
export type TelegramMessage = z.infer<typeof TelegramMessageSchema>;

export const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: TelegramMessageSchema.optional(),
  // edited_message / channel_post / callback_query etc. are present in the wire format but we only
  // subscribe to `message` (api.setWebhook allowed_updates). Anything else is classified `ignore`.
});
export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;

// ── Classified inbound (the structural read, pre-enrichment) ──────────────────────────────────────

// A reference to a file the owner attached, carried forward so enrich.ts can download + interpret it.
export type TelegramFileRef = {
  fileId: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
};

export type TelegramInboundClassified =
  | {
      kind: "text";
      botId: string;
      chatId: number;
      messageId: number;
      updateId: number;
      text: string;
    }
  | {
      kind: "voice";
      botId: string;
      chatId: number;
      messageId: number;
      updateId: number;
      caption: string;
      file: TelegramFileRef;
    }
  | {
      kind: "document";
      botId: string;
      chatId: number;
      messageId: number;
      updateId: number;
      caption: string;
      file: TelegramFileRef;
    }
  | { kind: "ignore"; reason: string };

function fileRef(f: {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}): TelegramFileRef {
  return {
    fileId: f.file_id,
    fileName: f.file_name ?? null,
    mimeType: f.mime_type ?? null,
    fileSize: f.file_size ?? null,
  };
}

/**
 * Validate a raw webhook body and classify it. `botId` is the bot the delivery is for (from the
 * webhook path), threaded onto the result so the gateway resolves the owner by (telegram, tg:botId).
 * Returns `ignore` (the route acks 200) for anything not a private text/voice/document message: a
 * non-message update, a group/channel message, a bot author, or an empty body. Never throws.
 */
export function classifyTelegramUpdate(rawBody: string, botId: string): TelegramInboundClassified {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { kind: "ignore", reason: "invalid_json" };
  }

  const parsed = TelegramUpdateSchema.safeParse(payload);
  if (!parsed.success) return { kind: "ignore", reason: "unsupported_update" };

  const msg = parsed.data.message;
  if (!msg) return { kind: "ignore", reason: "non_message_update" };

  // Only private DMs to the bot (PA-CHAN-5 trust posture: a group chat is a many-party surface we do
  // not answer this phase — mirrors the Slack adapter answering DMs + explicit @mentions only).
  if (msg.chat.type !== "private") return { kind: "ignore", reason: `chat_type:${msg.chat.type}` };
  // Loop guard: never answer another bot (or our own echo).
  if (msg.from?.is_bot) return { kind: "ignore", reason: "bot_author" };

  const base = {
    botId,
    chatId: msg.chat.id,
    messageId: msg.message_id,
    updateId: parsed.data.update_id,
  };
  const caption = (msg.caption ?? "").trim();

  // A voice note or an audio clip → transcribe. Voice is the common case (the mic button).
  const audioLike = msg.voice ?? msg.audio;
  if (audioLike) {
    return { kind: "voice", ...base, caption, file: fileRef(audioLike) };
  }

  if (msg.document) {
    return { kind: "document", ...base, caption, file: fileRef(msg.document) };
  }

  const text = (msg.text ?? "").trim();
  if (text) return { kind: "text", ...base, text };

  return { kind: "ignore", reason: "empty_message" };
}
