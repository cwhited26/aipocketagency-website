// POST /api/channels/slack/events — the Channels Gateway Slack Events API webhook (PA-CHAN-1/4).
//
// This route is NOT behind the app's auth middleware (the matcher covers /app + /api/app only), so
// it authenticates itself: the Slack adapter HMAC-verifies every request against the signing secret
// before the body is trusted (PA-CHAN-4 — never accept unsigned traffic). It then hands a parsed,
// normalized ChannelMessage to the gateway, which resolves the owner, dispatches through the
// Persona runner, and replies via the adapter.
//
// Latency / retries: the agent turn can exceed Slack's 3-second ack window, so Slack marks the
// delivery failed and retries with an X-Slack-Retry-Num header — we ack and skip those, so only the
// first delivery (which runs to completion and posts the reply) answers. No dedupe table needed.

import { NextRequest, NextResponse } from "next/server";
import { readSlackInbound } from "@/lib/channels/adapters/slack/adapter";
import { routeChannelMessage } from "@/lib/channels/gateway";
import { parseContextFromRequest } from "@/lib/channels/types";
import { channelLog } from "@/lib/channels/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Plain 200 ack. Slack only needs a 2xx; the body is ignored for event_callbacks.
function ack(): NextResponse {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // The raw body is required verbatim for the HMAC — read it before any JSON parse.
  const rawBody = await req.text();
  const ctx = parseContextFromRequest(req, rawBody);

  const inbound = readSlackInbound(ctx);

  if (inbound.kind === "unsigned") {
    // Includes the "signing secret not configured" case — refuse rather than accept unverifiable.
    const status = inbound.reason === "not_configured" ? 501 : 401;
    return NextResponse.json({ error: `signature_${inbound.reason}` }, { status });
  }

  // URL-verification handshake (echo the challenge back when setting the Request URL).
  if (inbound.kind === "challenge") {
    return NextResponse.json({ challenge: inbound.challenge });
  }

  // Skip Slack's automatic retries (our first delivery is still finishing and will reply).
  if (req.headers.get("x-slack-retry-num")) return ack();

  if (inbound.kind === "ignore") return ack();

  // A routable message → run it through the gateway. Errors are swallowed into the ack so a single
  // bad message never wedges the webhook (Slack would otherwise retry indefinitely).
  try {
    const outcome = await routeChannelMessage(inbound.message);
    channelLog.info("slack inbound routed", {
      handled: outcome.handled,
      surface: inbound.message.channelMeta.surface,
    });
  } catch (err) {
    channelLog.error("slack inbound routing threw", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return ack();
}
