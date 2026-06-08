// connector.slack.send_dm — send a direct message to a user (SPEC v5 §9.5).
//
// Write action — approval-gated, and the highest-sting Slack action (a DM to the wrong person
// can't be un-seen), so per the roadmap §2.1 its auto-approve stays per-recipient and never
// blanket. Two-step: conversations.open({users}) → chat.postMessage to the returned IM channel.

import { z } from "zod";
import { slackApiCall, type SlackResult } from "@/lib/slack";
import type { SlackActionDescriptor, SlackActionResult } from "../action-types";

export const SendDmInputSchema = z.object({
  // Slack user id (U…/W…), NOT a display name or email.
  user_id: z.string().min(1, "user_id is required"),
  text: z.string().min(1, "text is required").max(40_000),
});
export type SendDmInput = z.infer<typeof SendDmInputSchema>;

function dryRunSummary(input: SendDmInput): string {
  const flat = input.text.replace(/\s+/g, " ").trim();
  const preview = flat.length > 280 ? `${flat.slice(0, 280).trimEnd()}…` : flat;
  return [`Send a direct message to user ${input.user_id}`, "", preview].join("\n");
}

function auditFields(input: SendDmInput): Record<string, unknown> {
  return {
    connector: "slack",
    action: "send_dm",
    userId: input.user_id,
    textLength: input.text.length,
  };
}

const ConversationsOpenResponseSchema = z.object({
  ok: z.literal(true),
  channel: z.object({ id: z.string() }),
});

const PostMessageResponseSchema = z.object({
  ok: z.literal(true),
  channel: z.string(),
  ts: z.string(),
});

async function execute(args: {
  token: string;
  input: SendDmInput;
}): Promise<SlackResult<SlackActionResult>> {
  // 1. Open (or fetch the existing) IM channel with the user.
  const opened = await slackApiCall(
    args.token,
    "conversations.open",
    { users: args.input.user_id },
    ConversationsOpenResponseSchema,
  );
  if (!opened.ok) return opened;

  // 2. Post into it.
  const sent = await slackApiCall(
    args.token,
    "chat.postMessage",
    { channel: opened.data.channel.id, text: args.input.text },
    PostMessageResponseSchema,
  );
  if (!sent.ok) return sent;

  return {
    ok: true,
    data: {
      summary: `DM sent to ${args.input.user_id} (ts ${sent.data.ts})`,
      data: { channel: sent.data.channel, ts: sent.data.ts, userId: args.input.user_id },
    },
  };
}

export const sendDmAction: SlackActionDescriptor<SendDmInput> = {
  name: "send_dm",
  description:
    "Send a direct message to a Slack user as the connected workspace app. Approval-gated; " +
    "auto-approve (if ever granted) stays per-recipient. Payload: user_id (a Slack id), text.",
  mutates: true,
  autoApproveEligibleByDefault: false,
  inputSchema: SendDmInputSchema,
  dryRunSummary,
  auditFields,
  execute,
};
