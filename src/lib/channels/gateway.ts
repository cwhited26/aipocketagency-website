// lib/channels/gateway.ts — the inbound router for the Channels Gateway (SPEC §5).
//
// One channel-agnostic path for every inbound message, regardless of which adapter parsed it:
//   1. Owner resolve   — (channel_slug, external_id) → the paired connection (+ owner + Persona).
//   2. Tier gate       — PA-CHAN-7: Personal Brain off / Business Agent = Slack / Pro+ = all.
//   3. Persist inbound — append the message to pa_channel_messages (forensics, 30d retention).
//   4. Persona dispatch — the SAME Wave-B runner the web app uses (dispatchUserGoal), with
//      untrusted_origin=true so the Gate Phase applies hardened gates and the LEARN phase never
//      proposes a Skill from channel content (PA-CHAN-5). A simple lookup (or an orchestrator-off
//      deployment) answers inline via the brain chat agent — the metered Sonnet 4.6 roundtrip.
//   5. Response shape  — a direct answer, or a staged-action reply that surfaces a Mission Control
//      link + block-kit button. PA-CHAN-6: NO external action fires from the channel; the owner
//      approves in the web app, which routes through the existing approve endpoint.
//   6. Outbound        — the adapter sends the reply back out the same channel.
//   7. Persist outbound + cost — the roundtrip is metered once as featureSlug='channels:slack'.
//
// Every external effect is injected via `deps` so the routing + gating + response logic is unit
// tested with mocks (no DB, no network, no LLM). Production wiring is in defaultDeps below.

import { getCurrentTier, type Tier } from "@/lib/personas/tier-caps";
import { tierAllowsChannel } from "@/lib/personas/tier-caps";
import { fetchPaUser, type PaUser } from "@/lib/pa-supabase";
import { fetchPersona } from "@/lib/personas/db";
import { getOrCreateChannelConversation } from "@/lib/pa-conversations";
import { runConversationTurn, type ConversationTurnResult } from "@/lib/chat/conversation-agent";
import { slackOrigin } from "@/lib/chat/message-origin";
import {
  dispatchUserGoal,
  DEFAULT_RUN_ZONE,
  type DispatchUserGoalInput,
} from "@/lib/orchestrator/dispatcher";
import type { DispatchOutcome } from "@/lib/orchestrator/types";
import {
  fetchChannelConnectionByExternalId,
  recordChannelMessage,
  disableChannelConnectionById,
} from "./store";
import { dispatchOutbound, type OutboundResult } from "./outbound";
import { channelLog } from "./log";
import type {
  ChannelConnection,
  ChannelMessage,
  ChannelResponse,
  ChannelSlug,
} from "./types";

const DEFAULT_OAUTH_REDIRECT_BASE = "https://aipocketagent.com";

// The chat tools whose use means PA staged something the owner reviews in Mission Control.
const STAGING_TOOLS = new Set(["draft_email", "draft_quote", "propose_brain_update"]);

// ── Dependency surface (mocked in tests) ──────────────────────────────────────────────────────

export type GatewayDeps = {
  resolveConnection: (slug: ChannelSlug, externalId: string) => Promise<ChannelConnection | null>;
  getTier: (ownerId: string) => Promise<Tier>;
  loadPaUser: (ownerId: string) => Promise<PaUser | null>;
  // The ContainmentGuard zone the run is scoped to: the answering Persona's knowledge zone, or the
  // owner's project-shared zone when no Persona is pinned to the channel.
  resolveRunZone: (personaId: string | null) => Promise<string>;
  ensureConversationId: (ownerId: string, slug: ChannelSlug) => Promise<string | null>;
  dispatchGoal: (input: DispatchUserGoalInput) => Promise<DispatchOutcome>;
  chatTurn: (opts: {
    paUser: PaUser;
    userId: string;
    conversationId: string;
    content: string;
    userMetadata: unknown;
    cost: { featureSlug: "channels:slack"; idempotencyKey: string };
  }) => Promise<ConversationTurnResult>;
  recordMessage: (params: {
    ownerId: string;
    connectionId: string;
    direction: "inbound" | "outbound";
    body: string;
    threadId: string | null;
    rawPayload?: unknown;
  }) => Promise<string | null>;
  send: (connection: ChannelConnection, response: ChannelResponse) => Promise<OutboundResult>;
  flagConnectionError: (connectionId: string) => Promise<void>;
  missionControlUrl: () => string;
};

async function defaultResolveRunZone(personaId: string | null): Promise<string> {
  if (!personaId) return DEFAULT_RUN_ZONE;
  const persona = await fetchPersona(personaId);
  return persona?.knowledge_zone_key ?? DEFAULT_RUN_ZONE;
}

export const defaultGatewayDeps: GatewayDeps = {
  resolveConnection: async (slug, externalId) => {
    const res = await fetchChannelConnectionByExternalId(slug, externalId);
    return res.ok ? res.data : null;
  },
  getTier: getCurrentTier,
  loadPaUser: async (ownerId) => {
    const res = await fetchPaUser(ownerId);
    return res.ok ? res.data : null;
  },
  resolveRunZone: defaultResolveRunZone,
  ensureConversationId: async (ownerId, slug) => {
    const res = await getOrCreateChannelConversation(ownerId, slug);
    return res.ok ? res.data.id : null;
  },
  dispatchGoal: (input) => dispatchUserGoal(input),
  chatTurn: (opts) => runConversationTurn(opts),
  recordMessage: (params) => recordChannelMessage(params),
  send: (connection, response) => dispatchOutbound(connection, response),
  flagConnectionError: (connectionId) => disableChannelConnectionById(connectionId),
  missionControlUrl: () => {
    const base = (process.env.PA_OAUTH_REDIRECT_BASE ?? DEFAULT_OAUTH_REDIRECT_BASE).replace(
      /\/+$/,
      "",
    );
    return `${base}/app/mission-control`;
  },
};

// ── Result (what the route acks on) ──────────────────────────────────────────────────────────

export type RouteOutcome =
  | { handled: "replied"; ok: boolean }
  | { handled: "unknown_sender" }
  | { handled: "disabled" }
  | { handled: "tier_blocked" }
  | { handled: "no_api_key"; ok: boolean }
  | { handled: "error"; reason: string };

// ── Entry point ────────────────────────────────────────────────────────────────────────────────

/**
 * Route one normalized inbound message: resolve the owner, gate on tier, dispatch through the
 * Persona runner, and send the reply back out. The outbound dispatcher picks the adapter for this
 * owner+channel by slug (SPEC §5.7), so the gateway never names a channel. Never throws — returns a
 * typed RouteOutcome the webhook acks on (Slack only needs a 200).
 */
export async function routeChannelMessage(
  message: ChannelMessage,
  deps: GatewayDeps = defaultGatewayDeps,
): Promise<RouteOutcome> {
  // 1. Owner resolve.
  const connection = await deps.resolveConnection(message.channelSlug, message.externalId);
  if (!connection) {
    channelLog.info("inbound from unknown sender — ignored", {
      channelSlug: message.channelSlug,
    });
    return { handled: "unknown_sender" };
  }
  if (!connection.enabled) return { handled: "disabled" };

  // 2. Tier gate (defense-in-depth; the connect flow also gates). A downgraded owner gets a plain
  // upgrade nudge, and we dispatch nothing (no LLM cost).
  const tier = await deps.getTier(connection.ownerId);
  if (!tierAllowsChannel(tier, message.channelSlug)) {
    await deps.send(connection, {
      text: "Texting your agent from Slack is part of the Business Agent plan and up. Upgrade in Settings and I'll start answering here.",
      threadId: message.threadId,
      channelMeta: message.channelMeta,
    });
    return { handled: "tier_blocked" };
  }

  // 3. Persist the inbound message (forensics).
  const inboundId = await deps.recordMessage({
    ownerId: connection.ownerId,
    connectionId: connection.id,
    direction: "inbound",
    body: message.body,
    threadId: message.threadId,
    rawPayload: message.rawPayload,
  });

  // Load the owner's PA context. No key → tell them in-place rather than going silent.
  const paUser = await deps.loadPaUser(connection.ownerId);
  if (!paUser) return { handled: "error", reason: "owner_not_found" };
  if (!paUser.anthropic_api_key) {
    const sent = await deps.send(connection, {
      text: "I'm connected to your Slack, but your agent still needs an Anthropic API key in Settings before I can answer. Add it and message me again.",
      threadId: message.threadId,
      channelMeta: message.channelMeta,
    });
    return { handled: "no_api_key", ok: sent.ok };
  }

  // 4. Persona dispatch — the same Wave-B runner the web app uses, flagged untrusted (PA-CHAN-5).
  const zone = await deps.resolveRunZone(connection.personaId);
  const response = await buildResponse(message, connection, paUser, inboundId, zone, deps);

  // 6. Outbound.
  const sent = await deps.send(connection, response);
  if (!sent.ok && sent.authError) {
    // Token revoked → flag the connection so the settings card prompts a reconnect.
    await deps.flagConnectionError(connection.id);
  }

  // 7. Persist the outbound reply (the inbound roundtrip's cost was metered inside the chat turn,
  // featureSlug='channels:slack', or by the orchestrator for a dispatched goal).
  await deps.recordMessage({
    ownerId: connection.ownerId,
    connectionId: connection.id,
    direction: "outbound",
    body: response.text,
    threadId: message.threadId,
  });

  return { handled: "replied", ok: sent.ok };
}

// ── Dispatch → ChannelResponse ───────────────────────────────────────────────────────────────

async function buildResponse(
  message: ChannelMessage,
  connection: ChannelConnection,
  paUser: PaUser,
  inboundId: string | null,
  zone: string,
  deps: GatewayDeps,
): Promise<ChannelResponse> {
  const mcButton = { label: "Open Mission Control →", url: deps.missionControlUrl() };
  const base = { threadId: message.threadId, channelMeta: message.channelMeta };

  const outcome = await deps.dispatchGoal({
    businessId: connection.ownerId,
    goal: message.body,
    zone,
    untrustedOrigin: true,
  });

  switch (outcome.kind) {
    case "simple":
    case "disabled":
      // A quick lookup, or the orchestrator is off → answer inline via the brain chat agent. This
      // is the metered Sonnet 4.6 roundtrip (featureSlug='channels:slack').
      return answerInline(message, connection, paUser, inboundId, mcButton, base, deps);

    case "dispatched":
    case "gated":
    case "capped":
    case "tier_limit_gated":
      // A run was planned / staged / held → surface the reason + a deep link into Mission Control.
      return { text: outcome.reason, buttons: [mcButton], ...base };

    case "tier_limit_warn":
      // The owner is near a limit; relay the choice (they decide in the web app).
      return { text: outcome.reason, buttons: [mcButton], ...base };
  }
}

async function answerInline(
  message: ChannelMessage,
  connection: ChannelConnection,
  paUser: PaUser,
  inboundId: string | null,
  mcButton: { label: string; url: string },
  base: { threadId: string | null; channelMeta: Record<string, unknown> },
  deps: GatewayDeps,
): Promise<ChannelResponse> {
  const conversationId = await deps.ensureConversationId(connection.ownerId, message.channelSlug);
  if (!conversationId) {
    return {
      text: "I couldn't open your agent thread. Message me again and I'll pick it up.",
      ...base,
    };
  }

  const surface = message.channelMeta.surface === "channel" ? "channel" : "im";
  const turn = await deps.chatTurn({
    paUser,
    userId: connection.ownerId,
    conversationId,
    content: message.body,
    userMetadata: slackOrigin(surface),
    cost: {
      featureSlug: "channels:slack",
      // One row per inbound roundtrip, anchored to the persisted inbound message (PA-CHAN §8.4).
      idempotencyKey: `channels:slack:${inboundId ?? `${connection.id}:${conversationId}`}`,
    },
  });

  if (!turn.ok) {
    channelLog.error("channel chat turn failed", {
      channelSlug: message.channelSlug,
      status: turn.status,
    });
    return { text: "I hit a snag answering that. Send it again and I'll retry.", ...base };
  }

  // If PA drafted / proposed something, it's now staged for approval — surface the Mission Control
  // link + button (PA-CHAN-6: the owner approves in the web app; nothing fires from Slack).
  const staged = turn.toolSteps.some((s) => STAGING_TOOLS.has(s.tool));
  return { text: turn.finalAnswer, buttons: staged ? [mcButton] : undefined, ...base };
}
