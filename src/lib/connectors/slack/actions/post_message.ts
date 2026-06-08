// connector.slack.post_message — post a message to a channel (SPEC v5 §9.5).
//
// Write action — approval-gated. Posts via chat.postMessage with the bot token. chat:write.public
// lets the bot post to a public channel it hasn't joined; a private channel still requires the
// bot to be invited (Slack returns not_in_channel otherwise, surfaced as a clean error).
//
// The schema + dry-run summary + audit fields are pure (unit-tested without a network); only
// execute() touches Slack.

import { z } from "zod";
import { slackApiCall, type SlackResult } from "@/lib/slack";
import type { SlackActionDescriptor, SlackActionResult } from "../action-types";

export const PostMessageInputSchema = z.object({
  // Channel id (C…/G…) or name (#general). Required.
  channel: z.string().min(1, "channel is required"),
  text: z.string().min(1, "text is required").max(40_000),
  // Optional Block Kit blocks (opaque to PA — passed straight through when present).
  blocks: z.array(z.record(z.string(), z.unknown())).max(50).optional(),
});
export type PostMessageInput = z.infer<typeof PostMessageInputSchema>;

function dryRunSummary(input: PostMessageInput): string {
  const flat = input.text.replace(/\s+/g, " ").trim();
  const preview = flat.length > 280 ? `${flat.slice(0, 280).trimEnd()}…` : flat;
  const lines = [`Post a message to ${input.channel}`];
  if (input.blocks && input.blocks.length > 0) {
    lines.push(`Includes ${input.blocks.length} Block Kit block(s).`);
  }
  lines.push("", preview);
  return lines.join("\n");
}

function auditFields(input: PostMessageInput): Record<string, unknown> {
  return {
    connector: "slack",
    action: "post_message",
    channel: input.channel,
    textLength: input.text.length,
    hasBlocks: Boolean(input.blocks && input.blocks.length > 0),
  };
}

// chat.postMessage success body (the fields we rely on).
const PostMessageResponseSchema = z.object({
  ok: z.literal(true),
  channel: z.string(),
  ts: z.string(),
});

async function execute(args: {
  token: string;
  input: PostMessageInput;
}): Promise<SlackResult<SlackActionResult>> {
  const body: Record<string, unknown> = { channel: args.input.channel, text: args.input.text };
  if (args.input.blocks && args.input.blocks.length > 0) body.blocks = args.input.blocks;

  const res = await slackApiCall(args.token, "chat.postMessage", body, PostMessageResponseSchema);
  if (!res.ok) return res;
  return {
    ok: true,
    data: {
      summary: `Posted to ${res.data.channel} (ts ${res.data.ts})`,
      data: { channel: res.data.channel, ts: res.data.ts },
    },
  };
}

export const postMessageAction: SlackActionDescriptor<PostMessageInput> = {
  name: "post_message",
  description:
    "Post a message to a Slack channel as the connected workspace app. Approval-gated: stages " +
    "in the Inbox first. Payload: channel (id or #name), text, optional Block Kit blocks.",
  mutates: true,
  autoApproveEligibleByDefault: false,
  inputSchema: PostMessageInputSchema,
  dryRunSummary,
  auditFields,
  execute,
};
