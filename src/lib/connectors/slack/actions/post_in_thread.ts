// connector.slack.post_in_thread — reply inside an existing thread (SPEC v5 §9.5).
//
// Write action — approval-gated. chat.postMessage with thread_ts set. This is the action the
// drafter sub-agent defaults to when the user is acting on a thread (roadmap §2.1 drafter
// behavior): channel + thread_ts come from the source surface. thread_ts is REQUIRED by the
// schema, so a draft with no resolvable thread context fails validation with a clear message
// rather than silently posting a top-level message to the channel.

import { z } from "zod";
import { slackApiCall, type SlackResult } from "@/lib/slack";
import type { SlackActionDescriptor, SlackActionResult } from "../action-types";

export const PostInThreadInputSchema = z.object({
  channel: z.string().min(1, "channel is required"),
  // The parent message ts that identifies the thread (e.g. "1716580000.000200").
  thread_ts: z.string().min(1, "thread_ts is required — a reply needs the source thread"),
  text: z.string().min(1, "text is required").max(40_000),
});
export type PostInThreadInput = z.infer<typeof PostInThreadInputSchema>;

function dryRunSummary(input: PostInThreadInput): string {
  const flat = input.text.replace(/\s+/g, " ").trim();
  const preview = flat.length > 280 ? `${flat.slice(0, 280).trimEnd()}…` : flat;
  return [`Reply in thread ${input.thread_ts} in ${input.channel}`, "", preview].join("\n");
}

function auditFields(input: PostInThreadInput): Record<string, unknown> {
  return {
    connector: "slack",
    action: "post_in_thread",
    channel: input.channel,
    threadTs: input.thread_ts,
    textLength: input.text.length,
  };
}

const PostMessageResponseSchema = z.object({
  ok: z.literal(true),
  channel: z.string(),
  ts: z.string(),
});

async function execute(args: {
  token: string;
  input: PostInThreadInput;
}): Promise<SlackResult<SlackActionResult>> {
  const res = await slackApiCall(
    args.token,
    "chat.postMessage",
    { channel: args.input.channel, thread_ts: args.input.thread_ts, text: args.input.text },
    PostMessageResponseSchema,
  );
  if (!res.ok) return res;
  return {
    ok: true,
    data: {
      summary: `Replied in thread ${args.input.thread_ts} in ${res.data.channel} (ts ${res.data.ts})`,
      data: { channel: res.data.channel, ts: res.data.ts, threadTs: args.input.thread_ts },
    },
  };
}

export const postInThreadAction: SlackActionDescriptor<PostInThreadInput> = {
  name: "post_in_thread",
  description:
    "Reply inside an existing Slack thread as the connected workspace app. Approval-gated. " +
    "Payload: channel, thread_ts (the parent message ts), text. Refuses without a thread_ts.",
  mutates: true,
  autoApproveEligibleByDefault: false,
  inputSchema: PostInThreadInputSchema,
  dryRunSummary,
  auditFields,
  execute,
};
