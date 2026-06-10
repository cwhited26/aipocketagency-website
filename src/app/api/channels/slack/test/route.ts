// POST /api/channels/slack/test — send a test message to the owner's Slack DM (PA-CHAN-1, SPEC §8.1).
//
// Confirms the connection works end-to-end on the outbound side: open a DM to the installing user
// and post a short hello via the same adapter the gateway uses. Ownership-scoped; never sends to a
// channel other than the owner's own IM.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchOwnerChannelConnectionFull } from "@/lib/channels/store";
import { dispatchOutbound } from "@/lib/channels/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const res = await fetchOwnerChannelConnectionFull(user.id, "slack");
  if (!res.ok) return NextResponse.json({ error: "lookup_failed" }, { status: res.status });
  const connection = res.data;
  if (!connection) return NextResponse.json({ error: "not_connected" }, { status: 404 });
  if (!connection.authToken) {
    return NextResponse.json({ error: "needs_reconnect" }, { status: 409 });
  }

  // chat.postMessage opens the IM when channel is the user's Slack id. external_id is "team:user".
  const slackUserId =
    typeof connection.config.slackUserId === "string"
      ? connection.config.slackUserId
      : connection.externalId.split(":")[1] ?? "";
  if (!slackUserId) return NextResponse.json({ error: "no_dm_target" }, { status: 409 });

  const sent = await dispatchOutbound(connection, {
    text: "Your Pocket Agent is connected to Slack. DM me here and I'll answer — and anything I draft, I'll stage in Mission Control for your okay first.",
    threadId: null,
    channelMeta: { channel: slackUserId, threadTs: null },
  });
  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.authError ? "needs_reconnect" : "send_failed" },
      { status: sent.authError ? 409 : 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
