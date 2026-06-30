// lib/channels/pairing.ts — the per-channel pairing flow descriptors. How an owner connects each
// channel: an OAuth install redirect (Slack), or a phone-link / QR (the queued phone + widget
// adapters). The owner page reads this to render the right CTA without hard-coding Slack's path.
//
// Phase 1 ships only the Slack descriptor; a new channel adds one entry here.

import type { ChannelSlug, PairingFlow } from "./types";

export type PairingDescriptor = {
  slug: ChannelSlug;
  flow: PairingFlow;
  // For an OAuth flow: the route that starts the install redirect. Null for non-OAuth flows.
  installPath: string | null;
};

const PAIRING: Partial<Record<ChannelSlug, PairingDescriptor>> = {
  slack: { slug: "slack", flow: "oauth", installPath: "/api/channels/slack/install" },
  // Telegram pairs by bot-token paste (no redirect): the owner mints a bot in BotFather, then posts
  // the token + webhook secret to the connect route. No install redirect, so installPath is null.
  telegram: { slug: "telegram", flow: "bot_token", installPath: null },
  // Voice (Phase 6): the owner provisions a number via the setup surface (API-driven), so there's no
  // install redirect — the flow is phone_link and the CTA lives on /app/settings/voice.
  voice: { slug: "voice", flow: "phone_link", installPath: null },
};

export function pairingDescriptor(slug: ChannelSlug): PairingDescriptor | null {
  return PAIRING[slug] ?? null;
}
