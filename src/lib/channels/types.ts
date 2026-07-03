// lib/channels/types.ts — the cross-channel primitives for the Channels Gateway (PA-CHAN-1).
//
// One inbound router + per-channel adapters. Every channel (Slack now; SMS / iMessage / WhatsApp /
// Telegram / web widget later) speaks to the gateway through ONE contract — `ChannelAdapter` —
// returning a normalized `ChannelMessage` on the way in and accepting a `ChannelResponse` on the
// way out. Adding a 6th channel is one adapter file + one webhook route + one row in
// pa_channel_connections; the gateway, the persona dispatcher, the approval loop, and the cost
// ledger never touch the new code. That's the moat over a per-channel one-off integration.
//
// These are pure types + interfaces — no I/O. The gateway (gateway.ts), the outbound dispatcher
// (outbound.ts), and the Slack adapter (adapters/slack/*) all depend on this file and nothing here
// depends on them, so a new adapter can be written against the contract in isolation.

import type { NextRequest } from "next/server";

// ── Channel identity ────────────────────────────────────────────────────────────────────────

// The channels Phase 1 ships, plus the queued ones, as a closed set so a typo can't invent a slug.
// Only 'slack' is wired this lane; the rest are reserved for follow-up adapters.
export const CHANNEL_SLUGS = [
  "slack",
  "sms",
  "imessage",
  "whatsapp",
  "telegram",
  "web_widget",
  // Phase 6 — Voice Call (Twilio + ElevenLabs + Whisper). No ChannelAdapter (the WS streaming model
  // doesn't fit parseInbound/sendOutbound); a voice connection rides pa_channel_connections for
  // storage + the settings surface, and the voice routes own the answer/stream/status flow.
  "voice",
] as const;
export type ChannelSlug = (typeof CHANNEL_SLUGS)[number];

export function isChannelSlug(value: string): value is ChannelSlug {
  return (CHANNEL_SLUGS as readonly string[]).includes(value);
}

// ── Connection (the paired channel, as the gateway sees it) ───────────────────────────────────

// The owner-resolved connection a message belongs to. Mirrors a pa_channel_connections row minus
// the raw encrypted token, which the adapter decrypts only at send time (outbound.ts).
export type ChannelConnection = {
  id: string;
  ownerId: string;
  channelSlug: ChannelSlug;
  externalId: string;
  // The Persona that answers on this channel (PA-CHAN-8); null = the gateway default Persona.
  personaId: string | null;
  // The decrypted bot/auth token the adapter sends with. Null until paired / on a read-only view.
  authToken: string | null;
  // Per-channel knobs (Slack: workspace, scopes, bot_user_id, team_id, slack_user_id).
  config: Record<string, unknown>;
  enabled: boolean;
};

// ── Inbound: the normalized message every adapter produces ────────────────────────────────────

// One inbound message, channel-agnostic. The gateway routes on this and nothing else, so the
// persona dispatcher never learns it came from Slack vs SMS.
export type ChannelMessage = {
  channelSlug: ChannelSlug;
  // The provider-side identity the gateway resolves an owner by — UNIQUE with channelSlug.
  // Slack: "<team_id>:<user_id>".
  externalId: string;
  // The user-authored text, already stripped of channel cruft (e.g. a leading @mention).
  body: string;
  // The thread/conversation handle to reply into (Slack: a channel id + optional thread_ts pair,
  // serialized). Opaque to the gateway; the adapter that produced it knows how to reply.
  threadId: string | null;
  // PA-CHAN-5: a channel message is untrusted inbound content (a coworker could be in the thread).
  // Always true for channel traffic; the dispatcher flags the sub-agent run so the Gate Phase
  // applies hardened gates and the LEARN phase never proposes a Skill from it.
  untrustedOrigin: boolean;
  // A provider-stable id for the inbound, when the channel has one (Telegram: "<botId>:<update_id>").
  // Anchors the inbound roundtrip's cost idempotency so a provider redelivery of the same message
  // collapses to one ledger row. Optional: a channel without a stable id (Slack relies on its
  // retry-num header instead) omits it and the gateway falls back to the persisted-row id.
  providerMessageId?: string;
  // Channel-specific routing metadata the adapter needs to send the reply back (Slack: channel id,
  // thread_ts, the inbound surface im|channel). Opaque to the gateway.
  channelMeta: Record<string, unknown>;
  // Attachment descriptors persisted to pa_channel_messages.attachments (Phase 2 SMS: the Supabase
  // Storage paths MMS media was saved to). Opaque to the gateway; omitted for text-only inbounds.
  attachments?: unknown;
  // The verbatim provider payload, persisted to pa_channel_messages.raw_payload (pruned after 30d).
  rawPayload: unknown;
};

// ── Outbound: what the gateway hands back to an adapter ───────────────────────────────────────

// A single block-kit-style action button on an outbound reply. Phase 1 (PA-CHAN-6) renders these
// ONLY as deep links into Mission Control — no external action fires from the channel. The owner
// taps through to the web app and approves there, routing the action through the existing approve
// endpoint. `url` is required; an action-fire button (no url) is the second-sprint surface.
export type ChannelButton = {
  label: string;
  url: string;
};

// The gateway's reply, channel-agnostic. The adapter renders `text` + optional `buttons` in its
// native affordance (Slack: a section block + an actions block of URL buttons).
export type ChannelResponse = {
  text: string;
  buttons?: ChannelButton[];
  // True when this reply surfaces a freshly STAGED action (a draft waiting in Mission Control).
  // Button-less channels (SMS, iMessage) render the APPROVE / EDIT / REJECT text protocol from it;
  // WhatsApp renders native reply buttons. Channels with URL buttons (Slack, Telegram) ignore it.
  staged?: boolean;
  // Echo the inbound thread handle so the adapter replies in-place.
  threadId: string | null;
  channelMeta: Record<string, unknown>;
};

// ── The adapter contract (PA-CHAN-1, SPEC §4.2) ───────────────────────────────────────────────

// How an owner pairs the channel. 'oauth' = an install redirect + callback (Slack). 'bot_token' = the
// owner pastes a bot token + webhook secret they minted (Telegram, via BotFather). 'phone_link' and
// 'qr' are reserved for the phone/widget adapters.
export type PairingFlow = "oauth" | "bot_token" | "phone_link" | "qr";

export type ChannelAdapter = {
  slug: ChannelSlug;
  pairingFlow: PairingFlow;
  // Verify the request signature and parse it into a normalized message. Returns null for anything
  // not routable to the gateway (a verification handshake the route handled, a bot echo, an edit,
  // an unsigned/forged request). MUST verify the signature before trusting the body (PA-CHAN-4).
  parseInbound(req: ParseInboundContext): Promise<ChannelMessage | null>;
  // Send a reply back out the channel. Throws ChannelSendError on a transport / auth failure so the
  // gateway can flip the connection to an error state.
  sendOutbound(connection: ChannelConnection, response: ChannelResponse): Promise<void>;
};

// The adapter parses from the raw request bytes (needed verbatim for the HMAC) plus the parsed
// headers — not the NextRequest directly, so parseInbound stays unit-testable without a live req.
export type ParseInboundContext = {
  rawBody: string;
  headers: Pick<Headers, "get">;
  nowSeconds: number;
};

// Thrown by sendOutbound on a transport / auth failure. `authError` flips the connection to an
// error state so the settings card prompts a reconnect (mirrors the connector re-auth pattern).
export class ChannelSendError extends Error {
  readonly authError: boolean;
  constructor(message: string, authError: boolean) {
    super(message);
    this.name = "ChannelSendError";
    this.authError = authError;
  }
}

// A small helper so a route can adapt a NextRequest into a ParseInboundContext once it has read the
// raw body (the body must be read before JSON parsing for the HMAC to match).
export function parseContextFromRequest(req: NextRequest, rawBody: string): ParseInboundContext {
  return { rawBody, headers: req.headers, nowSeconds: Math.floor(Date.now() / 1000) };
}
