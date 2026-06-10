// lib/channels/registry.ts — the adapter registry. Maps a channel slug to its ChannelAdapter so
// the outbound dispatcher (and any future caller) can resolve the right adapter without importing
// each one. Phase 1 registers only Slack; a new channel adds exactly one line here.

import type { ChannelAdapter, ChannelSlug } from "./types";
import { slackAdapter } from "./adapters/slack/adapter";

const ADAPTERS: Partial<Record<ChannelSlug, ChannelAdapter>> = {
  slack: slackAdapter,
};

/** The adapter for a channel, or null if that channel isn't wired yet. */
export function getAdapter(slug: ChannelSlug): ChannelAdapter | null {
  return ADAPTERS[slug] ?? null;
}
