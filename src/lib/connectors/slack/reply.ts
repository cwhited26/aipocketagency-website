// lib/connectors/slack/reply.ts — post PA's reply back into Slack on the inbound path (PA-SLACK-DM-1).
//
// This is NOT a gated connector write-action (those stage in the Approval Inbox). An inbound DM
// reply is the direct answer the owner asked for by messaging the bot, so it posts immediately —
// the same trust model as replying in any chat surface. It reuses the connector's token lifecycle
// (ensureFreshSlackToken) and the shared Web API transport (slackApiCall); nothing new touches Slack.

import { z } from "zod";
import { slackApiCall, type SlackResult } from "@/lib/slack";
import type { SlackConnectionFull } from "@/lib/pa-slack-connections";
import { ensureFreshSlackToken } from "./oauth";

const PostMessageResponseSchema = z.object({
  ok: z.literal(true),
  channel: z.string(),
  ts: z.string(),
});

/**
 * Post `text` into `channel`. For a channel @mention pass `threadTs` to thread the reply under
 * the mention; for a DM leave it null to reply flat in the IM. Returns the posted message ts.
 */
export async function postSlackReply(args: {
  connection: SlackConnectionFull;
  channel: string;
  text: string;
  threadTs: string | null;
}): Promise<SlackResult<{ channel: string; ts: string }>> {
  const token = await ensureFreshSlackToken(args.connection);
  if (!token.ok) return token;

  const body: Record<string, unknown> = { channel: args.channel, text: args.text };
  if (args.threadTs) body.thread_ts = args.threadTs;

  const res = await slackApiCall(token.data, "chat.postMessage", body, PostMessageResponseSchema);
  if (!res.ok) return res;
  return { ok: true, data: { channel: res.data.channel, ts: res.data.ts } };
}
