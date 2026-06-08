// POST /api/connectors/slack/events — the inbound Slack Events API webhook (PA-SLACK-DM-1).
//
// Closes the Slack loop: the owner DMs the bot (or @mentions it in a channel), PA runs the agent
// over their brain, and replies in-place. The matching outbound write-actions (post_message /
// send_dm) shipped with the Connections expansion; this is the receive side.
//
// This route is NOT behind the app's auth middleware (matcher covers /app + /api/app only), so it
// authenticates the request itself: every event is HMAC-verified against the app's Signing Secret
// before any payload is trusted. The owner is then resolved from the event's Slack user id back to
// their pa_connections row (migration 035), and the message runs as that owner.
//
// Latency / retries: the agent turn can exceed Slack's 3-second ack window, so Slack will mark the
// delivery failed and retry. Retries carry an `X-Slack-Retry-Num` header — we ack and skip them, so
// the first delivery (which keeps running to completion and posts the reply) is the only one that
// answers. This avoids double-replies without needing a dedupe table.

import { NextRequest, NextResponse } from "next/server";
import { slackSigningSecret } from "@/lib/slack";
import { verifySlackSignature, parseSlackEvent } from "@/lib/connectors/slack/events";
import { postSlackReply } from "@/lib/connectors/slack/reply";
import {
  fetchSlackConnectionBySlackUserId,
  markSlackConnectionError,
} from "@/lib/pa-slack-connections";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getOrCreateSlackConversation } from "@/lib/pa-conversations";
import { runConversationTurn } from "@/lib/chat/conversation-agent";
import { slackOrigin } from "@/lib/chat/message-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Plain 200 ack. Slack only needs a 2xx; the body is ignored for event_callbacks.
function ack(): NextResponse {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signingSecret = slackSigningSecret();
  if (!signingSecret) {
    // Inbound isn't configured for this deployment — refuse rather than accept unverifiable events.
    return NextResponse.json({ error: "slack_inbound_not_configured" }, { status: 501 });
  }

  // The raw body is required verbatim for the HMAC — read it before any JSON parse.
  const rawBody = await req.text();

  const sig = verifySlackSignature({
    signingSecret,
    timestamp: req.headers.get("x-slack-request-timestamp"),
    signature: req.headers.get("x-slack-signature"),
    rawBody,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!sig.ok) {
    return NextResponse.json({ error: `signature_${sig.reason}` }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = parseSlackEvent(payload);

  // URL-verification handshake (echo the challenge back when setting the Request URL).
  if (event.kind === "challenge") {
    return NextResponse.json({ challenge: event.challenge });
  }

  // Skip Slack's automatic retries (our first delivery is still finishing and will reply).
  if (req.headers.get("x-slack-retry-num")) return ack();

  if (event.kind === "ignore") return ack();

  // Resolve the owner behind the Slack author. Unknown sender / not connected → ack and do nothing.
  const connResult = await fetchSlackConnectionBySlackUserId(event.slackUserId, event.teamId);
  if (!connResult.ok || !connResult.data) return ack();
  const connection = connResult.data;

  const paResult = await fetchPaUser(connection.user_id);
  if (!paResult.ok || !paResult.data) return ack();
  const paUser = paResult.data;

  // Connected but not yet able to answer — tell them in-place rather than going silent.
  if (!paUser.anthropic_api_key) {
    await postSlackReply({
      connection,
      channel: event.channel,
      threadTs: event.threadTs,
      text: "I'm connected to your Slack, but your Pocket Agent still needs an Anthropic API key in Settings before I can answer. Add it and message me again.",
    });
    return ack();
  }

  const convResult = await getOrCreateSlackConversation(connection.user_id);
  if (!convResult.ok) {
    await postSlackReply({
      connection,
      channel: event.channel,
      threadTs: event.threadTs,
      text: "I couldn't open your Pocket Agent thread just now. Try messaging me again in a moment.",
    });
    return ack();
  }

  const turn = await runConversationTurn({
    paUser,
    userId: connection.user_id,
    conversationId: convResult.data.id,
    content: event.text,
    userMetadata: slackOrigin(event.surface),
  });

  const replyText = turn.ok
    ? turn.finalAnswer
    : "I hit a snag answering that just now. Try me again in a moment.";

  const reply = await postSlackReply({
    connection,
    channel: event.channel,
    threadTs: event.threadTs,
    text: replyText,
  });

  // A hard auth failure on the reply means the bot token was revoked — flip the connection to
  // 'error' so the Connections card prompts a reconnect (mirrors the connector re-auth pattern).
  if (!reply.ok && reply.authError) {
    await markSlackConnectionError(connection.id);
  }

  return ack();
}
