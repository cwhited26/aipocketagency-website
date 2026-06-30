// lib/channels/registry.ts — the adapter registry. Maps a channel slug to its ChannelAdapter so
// the outbound dispatcher (and any future caller) can resolve the right adapter without importing
// each one. Slack landed in Phase 1, Telegram in Phase 2; a new channel adds exactly one line here.

import type { ChannelAdapter, ChannelSlug } from "./types";
import { slackAdapter } from "./adapters/slack/adapter";
import { telegramAdapter } from "./adapters/telegram/adapter";

const ADAPTERS: Partial<Record<ChannelSlug, ChannelAdapter>> = {
  slack: slackAdapter,
  telegram: telegramAdapter,
};

/** The adapter for a channel, or null if that channel isn't wired yet. */
export function getAdapter(slug: ChannelSlug): ChannelAdapter | null {
  return ADAPTERS[slug] ?? null;
}
