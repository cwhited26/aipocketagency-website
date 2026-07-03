// lib/channels/registry.ts — the adapter registry. Maps a channel slug to its ChannelAdapter so
// the outbound dispatcher (and any future caller) can resolve the right adapter without importing
// each one. Slack landed in Phase 1, Telegram alongside it; SMS (Twilio), iMessage (BlueBubbles),
// and WhatsApp (Meta Cloud API) landed as the SPEC's Phases 2–4. Voice joined in v2 (PA-CHAN-15)
// once call semantics were mapped onto the contract (inbound = a ringing call, outbound = placing
// one). A new channel adds exactly one line here.

import type { ChannelAdapter, ChannelSlug } from "./types";
import { slackAdapter } from "./adapters/slack/adapter";
import { telegramAdapter } from "./adapters/telegram/adapter";
import { smsAdapter } from "./adapters/sms/adapter";
import { imessageAdapter } from "./adapters/imessage/adapter";
import { whatsappAdapter } from "./adapters/whatsapp/adapter";
import { voiceAdapter } from "./adapters/voice/adapter";

const ADAPTERS: Partial<Record<ChannelSlug, ChannelAdapter>> = {
  slack: slackAdapter,
  telegram: telegramAdapter,
  sms: smsAdapter,
  imessage: imessageAdapter,
  whatsapp: whatsappAdapter,
  voice: voiceAdapter,
};

/** The adapter for a channel, or null if that channel isn't wired yet. */
export function getAdapter(slug: ChannelSlug): ChannelAdapter | null {
  return ADAPTERS[slug] ?? null;
}
