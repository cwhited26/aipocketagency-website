// connector.slack.list_recent_messages — recent messages in a channel (SPEC v5 §9.5).
//
// Read action — no approval gate (auto-approve eligible from day one, roadmap §2.1). Gives the
// drafter sub-agent the surrounding thread/channel context before it drafts a reply.
// conversations.history, newest first, capped.

import { z } from "zod";
import { slackApiCall, type SlackResult } from "@/lib/slack";
import type { SlackActionDescriptor, SlackActionResult } from "../action-types";

export const ListRecentMessagesInputSchema = z.object({
  channel: z.string().min(1, "channel is required"),
  limit: z.number().int().positive().max(200).default(20),
});
export type ListRecentMessagesInput = z.infer<typeof ListRecentMessagesInputSchema>;

function dryRunSummary(input: ListRecentMessagesInput): string {
  return `Read the last ${input.limit} messages in ${input.channel} (read-only).`;
}

function auditFields(input: ListRecentMessagesInput): Record<string, unknown> {
  return {
    connector: "slack",
    action: "list_recent_messages",
    channel: input.channel,
    limit: input.limit,
  };
}

const ConversationsHistoryResponseSchema = z.object({
  ok: z.literal(true),
  messages: z
    .array(
      z.object({
        ts: z.string(),
        user: z.string().optional(),
        text: z.string().optional(),
        thread_ts: z.string().optional(),
      }),
    )
    .default([]),
});

async function execute(args: {
  token: string;
  input: ListRecentMessagesInput;
}): Promise<SlackResult<SlackActionResult>> {
  const res = await slackApiCall(
    args.token,
    "conversations.history",
    { channel: args.input.channel, limit: args.input.limit },
    ConversationsHistoryResponseSchema,
  );
  if (!res.ok) return res;

  const messages = res.data.messages.map((m) => ({
    ts: m.ts,
    user: m.user ?? null,
    text: m.text ?? "",
    threadTs: m.thread_ts ?? null,
  }));
  return {
    ok: true,
    data: {
      summary: `Read ${messages.length} message(s) from ${args.input.channel}`,
      data: { channel: args.input.channel, messages },
    },
  };
}

export const listRecentMessagesAction: SlackActionDescriptor<ListRecentMessagesInput> = {
  name: "list_recent_messages",
  description:
    "Read recent messages in a Slack channel for reply context. Read-only — runs without " +
    "approval. Payload: channel, optional limit.",
  mutates: false,
  autoApproveEligibleByDefault: true,
  inputSchema: ListRecentMessagesInputSchema,
  dryRunSummary,
  auditFields,
  execute,
};
