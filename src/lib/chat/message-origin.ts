// lib/chat/message-origin.ts — the contract for where a conversation message came in from, when
// it wasn't typed in the Ask box. Rides in pocket_agent_messages.metadata (migration 034), the
// same jsonb the upload card uses; a given message carries one or the other, never both.
//
// Today the only off-app origin is an inbound Slack message (PA-SLACK-DM-1): the owner DMs the bot
// or @mentions it, the agent answers in-place, and the user turn renders with a "Slack" chip so the
// thread shows the message arrived from outside the app. One Zod source of truth so a drifted blob
// fails validation and degrades to a plain bubble instead of crashing the thread.

import { z } from "zod";

export const SLACK_ORIGIN_KIND = "slack_origin" as const;

export const SlackOriginSchema = z.object({
  kind: z.literal(SLACK_ORIGIN_KIND),
  /** "im" = a DM to the bot; "channel" = an @mention in a channel. Drives the chip label. */
  surface: z.enum(["im", "channel"]),
});
export type SlackOrigin = z.infer<typeof SlackOriginSchema>;

/** Build the metadata blob stamped on an inbound Slack user message. */
export function slackOrigin(surface: SlackOrigin["surface"]): SlackOrigin {
  return { kind: SLACK_ORIGIN_KIND, surface };
}

/** Safe-parses message.metadata into a Slack origin, or null if it isn't one. */
export function asSlackOrigin(metadata: unknown): SlackOrigin | null {
  const parsed = SlackOriginSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}

// ── SMS origin (PA-SMS-1) ──────────────────────────────────────────────────────
// An inbound text to the owner's dedicated PA number lands in their PA chat thread; the user turn
// renders with an "SMS" chip so the thread shows it arrived by text. Same metadata channel as the
// Slack origin above — a message carries one origin blob (or the upload card), never two.

export const SMS_ORIGIN_KIND = "sms_origin" as const;

export const SmsOriginSchema = z.object({
  kind: z.literal(SMS_ORIGIN_KIND),
});
export type SmsOrigin = z.infer<typeof SmsOriginSchema>;

/** Build the metadata blob stamped on an inbound SMS user message. */
export function smsOrigin(): SmsOrigin {
  return { kind: SMS_ORIGIN_KIND };
}

/** Safe-parses message.metadata into an SMS origin, or null if it isn't one. */
export function asSmsOrigin(metadata: unknown): SmsOrigin | null {
  const parsed = SmsOriginSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}

// ── Telegram origin (Channels Gateway Phase 2) ─────────────────────────────────
// An inbound Telegram DM to the owner's bot lands in their PA chat thread; the user turn renders with
// a "Telegram" chip so the thread shows it arrived from Telegram. Same metadata channel as the Slack
// + SMS origins above — a message carries one origin blob (or the upload card), never two.

export const TELEGRAM_ORIGIN_KIND = "telegram_origin" as const;

export const TelegramOriginSchema = z.object({
  kind: z.literal(TELEGRAM_ORIGIN_KIND),
});
export type TelegramOrigin = z.infer<typeof TelegramOriginSchema>;

/** Build the metadata blob stamped on an inbound Telegram user message. */
export function telegramOrigin(): TelegramOrigin {
  return { kind: TELEGRAM_ORIGIN_KIND };
}

/** Safe-parses message.metadata into a Telegram origin, or null if it isn't one. */
export function asTelegramOrigin(metadata: unknown): TelegramOrigin | null {
  const parsed = TelegramOriginSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}

// ── iMessage origin (Channels Gateway Phase 3) ─────────────────────────────────
// An inbound iMessage relayed by the owner's BlueBubbles server lands in their PA chat thread; the
// user turn renders with an "iMessage" chip. Same one-origin-per-message contract as above.

export const IMESSAGE_ORIGIN_KIND = "imessage_origin" as const;

export const ImessageOriginSchema = z.object({
  kind: z.literal(IMESSAGE_ORIGIN_KIND),
});
export type ImessageOrigin = z.infer<typeof ImessageOriginSchema>;

/** Build the metadata blob stamped on an inbound iMessage user message. */
export function imessageOrigin(): ImessageOrigin {
  return { kind: IMESSAGE_ORIGIN_KIND };
}

/** Safe-parses message.metadata into an iMessage origin, or null if it isn't one. */
export function asImessageOrigin(metadata: unknown): ImessageOrigin | null {
  const parsed = ImessageOriginSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}

// ── WhatsApp origin (Channels Gateway Phase 4) ─────────────────────────────────
// An inbound WhatsApp message to the owner's Business number lands in their PA chat thread; the
// user turn renders with a "WhatsApp" chip. Same one-origin-per-message contract as above.

export const WHATSAPP_ORIGIN_KIND = "whatsapp_origin" as const;

export const WhatsappOriginSchema = z.object({
  kind: z.literal(WHATSAPP_ORIGIN_KIND),
});
export type WhatsappOrigin = z.infer<typeof WhatsappOriginSchema>;

/** Build the metadata blob stamped on an inbound WhatsApp user message. */
export function whatsappOrigin(): WhatsappOrigin {
  return { kind: WHATSAPP_ORIGIN_KIND };
}

/** Safe-parses message.metadata into a WhatsApp origin, or null if it isn't one. */
export function asWhatsappOrigin(metadata: unknown): WhatsappOrigin | null {
  const parsed = WhatsappOriginSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}
