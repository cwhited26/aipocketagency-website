// lib/channels/adapters/slack/adapter.ts — the Slack ChannelAdapter (PA-CHAN-1, SPEC §8).
//
// Inbound: verify the Events API signature (PA-CHAN-4), parse the envelope, and reduce it to a
// normalized ChannelMessage (a DM to the bot, or an @mention in a channel). Loop-safe: our own
// replies arrive back as message.im events carrying a bot_id and are dropped.
//
// Outbound: chat.postMessage with the reply text plus block-kit URL buttons that deep-link into
// Mission Control (PA-CHAN-6 — no external action fires from the channel this phase; the owner
// taps through and approves in the web app, which routes through the existing approve endpoint).
//
// Direct REST against the Slack Web API via the shared slackApiCall helper — no SDK. The adapter is
// self-contained: it does not import the legacy connectors/slack module, so the gateway and the
// legacy Slack Connection can evolve (or be retired) independently.

import { z } from "zod";
import { slackApiCall, slackSigningSecret, type SlackResult } from "@/lib/slack";
import {
  ChannelSendError,
  type ChannelAdapter,
  type ChannelConnection,
  type ChannelMessage,
  type ChannelResponse,
  type ParseInboundContext,
} from "@/lib/channels/types";
import { channelLog } from "@/lib/channels/log";
import { verifySlackSignature } from "./signing";

// ── Inbound envelope schemas ──────────────────────────────────────────────────────────────────

const UrlVerificationSchema = z.object({
  type: z.literal("url_verification"),
  challenge: z.string().min(1),
});

const InnerEventSchema = z.object({
  type: z.string(),
  user: z.string().optional(),
  bot_id: z.string().optional(),
  subtype: z.string().optional(),
  text: z.string().optional(),
  channel: z.string().optional(),
  channel_type: z.string().optional(),
  ts: z.string().optional(),
  thread_ts: z.string().optional(),
});

const EventCallbackSchema = z.object({
  type: z.literal("event_callback"),
  team_id: z.string().optional(),
  event: InnerEventSchema,
});

/** Strip a leading bot mention token (`<@U123>`) so the agent reads the ask, not the mention. */
export function stripLeadingMention(text: string): string {
  return text.replace(/^\s*<@[A-Z0-9]+>\s*/i, "").trim();
}

// ── The rich inbound read (verify + classify in one pass) ──────────────────────────────────────

export type SlackInboundResult =
  | { kind: "challenge"; challenge: string }
  | { kind: "message"; message: ChannelMessage }
  | { kind: "ignore"; reason: string }
  | { kind: "unsigned"; reason: string };

/**
 * Verify the signature and classify one inbound Slack request. The single trust gate: an unsigned /
 * forged / stale request returns `unsigned` (the route answers 401) and the body is never parsed
 * into a routable message.
 */
export function readSlackInbound(ctx: ParseInboundContext): SlackInboundResult {
  const signingSecret = slackSigningSecret();
  if (!signingSecret) return { kind: "unsigned", reason: "not_configured" };

  const sig = verifySlackSignature({
    signingSecret,
    timestamp: ctx.headers.get("x-slack-request-timestamp"),
    signature: ctx.headers.get("x-slack-signature"),
    rawBody: ctx.rawBody,
    nowSeconds: ctx.nowSeconds,
  });
  if (!sig.ok) return { kind: "unsigned", reason: sig.reason };

  let payload: unknown;
  try {
    payload = JSON.parse(ctx.rawBody);
  } catch {
    return { kind: "ignore", reason: "invalid_json" };
  }

  const challenge = UrlVerificationSchema.safeParse(payload);
  if (challenge.success) return { kind: "challenge", challenge: challenge.data.challenge };

  const callback = EventCallbackSchema.safeParse(payload);
  if (!callback.success) return { kind: "ignore", reason: "unsupported_envelope" };

  const { event, team_id } = callback.data;

  // Loop / noise guards: our own bot echo, any message subtype (edits, deletes, joins), no author.
  if (event.bot_id) return { kind: "ignore", reason: "bot_message" };
  if (event.subtype) return { kind: "ignore", reason: `subtype:${event.subtype}` };
  if (!event.user) return { kind: "ignore", reason: "no_user" };
  if (!event.channel) return { kind: "ignore", reason: "no_channel" };

  const teamId = team_id ?? "";
  const externalId = `${teamId}:${event.user}`;

  if (event.type === "app_mention") {
    const text = stripLeadingMention(event.text ?? "");
    if (!text) return { kind: "ignore", reason: "empty_mention" };
    // Thread under the existing thread if there is one, else under the mention message itself.
    const threadTs = event.thread_ts ?? event.ts ?? null;
    return {
      kind: "message",
      message: buildMessage({
        externalId,
        body: text,
        channel: event.channel,
        threadTs,
        surface: "channel",
        rawPayload: payload,
      }),
    };
  }

  if (event.type === "message") {
    // Only DMs to the bot (im). Channel messages without an @mention are not ours to answer.
    if (event.channel_type !== "im") return { kind: "ignore", reason: "non_im_message" };
    const text = (event.text ?? "").trim();
    if (!text) return { kind: "ignore", reason: "empty_message" };
    return {
      kind: "message",
      message: buildMessage({
        externalId,
        body: text,
        channel: event.channel,
        threadTs: null,
        surface: "im",
        rawPayload: payload,
      }),
    };
  }

  return { kind: "ignore", reason: `event_type:${event.type}` };
}

function buildMessage(args: {
  externalId: string;
  body: string;
  channel: string;
  threadTs: string | null;
  surface: "im" | "channel";
  rawPayload: unknown;
}): ChannelMessage {
  return {
    channelSlug: "slack",
    externalId: args.externalId,
    body: args.body,
    threadId: args.threadTs,
    // PA-CHAN-5: every channel message is untrusted inbound content.
    untrustedOrigin: true,
    channelMeta: { channel: args.channel, threadTs: args.threadTs, surface: args.surface },
    rawPayload: args.rawPayload,
  };
}

// ── Outbound (block-kit reply) ──────────────────────────────────────────────────────────────────

const PostMessageResponseSchema = z.object({
  ok: z.literal(true),
  channel: z.string(),
  ts: z.string(),
});

// Slack block-kit limits a single text section to 3000 chars; clip defensively.
function clip(text: string, max = 2900): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

// Build the blocks for a reply: a markdown section, plus an actions row of URL buttons when present.
function buildBlocks(response: ChannelResponse): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [
    { type: "section", text: { type: "mrkdwn", text: clip(response.text) } },
  ];
  if (response.buttons && response.buttons.length > 0) {
    blocks.push({
      type: "actions",
      elements: response.buttons.slice(0, 5).map((b) => ({
        type: "button",
        text: { type: "plain_text", text: clip(b.label, 75) },
        url: b.url,
      })),
    });
  }
  return blocks;
}

function readChannelMeta(meta: Record<string, unknown>): { channel: string; threadTs: string | null } {
  const channel = typeof meta.channel === "string" ? meta.channel : "";
  const threadTs = typeof meta.threadTs === "string" ? meta.threadTs : null;
  return { channel, threadTs };
}

async function sendOutbound(
  connection: ChannelConnection,
  response: ChannelResponse,
): Promise<void> {
  if (!connection.authToken) {
    throw new ChannelSendError("no_token", true);
  }
  const { channel, threadTs } = readChannelMeta(response.channelMeta);
  if (!channel) {
    throw new ChannelSendError("no_channel", false);
  }

  const body: Record<string, unknown> = {
    channel,
    text: clip(response.text),
    blocks: buildBlocks(response),
  };
  if (threadTs) body.thread_ts = threadTs;

  const res: SlackResult<unknown> = await slackApiCall(
    connection.authToken,
    "chat.postMessage",
    body,
    PostMessageResponseSchema,
  );
  if (!res.ok) {
    channelLog.error("slack chat.postMessage failed", {
      connectionId: connection.id,
      status: res.status,
      authError: res.authError,
    });
    throw new ChannelSendError(res.error, res.authError);
  }
}

export const slackAdapter: ChannelAdapter = {
  slug: "slack",
  pairingFlow: "oauth",
  async parseInbound(ctx: ParseInboundContext): Promise<ChannelMessage | null> {
    const result = readSlackInbound(ctx);
    return result.kind === "message" ? result.message : null;
  },
  sendOutbound,
};
