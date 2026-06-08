// connector.slack.list_channels — list channels the app can see (SPEC v5 §9.5).
//
// Read action — no approval gate (auto-approve eligible from day one, roadmap §2.1). Backs the
// drafter's "which channel?" resolution and the owner's channel picker. conversations.list with
// the public + private types the granted scopes cover.

import { z } from "zod";
import { slackApiCall, type SlackResult } from "@/lib/slack";
import type { SlackActionDescriptor, SlackActionResult } from "../action-types";

export const ListChannelsInputSchema = z.object({
  // Slack caps page size at 1000; default 200 is plenty for a picker.
  limit: z.number().int().positive().max(1000).default(200),
  // Exclude archived channels by default.
  exclude_archived: z.boolean().default(true),
});
export type ListChannelsInput = z.infer<typeof ListChannelsInputSchema>;

function dryRunSummary(input: ListChannelsInput): string {
  return `List up to ${input.limit} Slack channels (read-only).`;
}

function auditFields(input: ListChannelsInput): Record<string, unknown> {
  return { connector: "slack", action: "list_channels", limit: input.limit };
}

const ConversationsListResponseSchema = z.object({
  ok: z.literal(true),
  channels: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        is_private: z.boolean().optional(),
        is_archived: z.boolean().optional(),
      }),
    )
    .default([]),
});

async function execute(args: {
  token: string;
  input: ListChannelsInput;
}): Promise<SlackResult<SlackActionResult>> {
  const res = await slackApiCall(
    args.token,
    "conversations.list",
    {
      limit: args.input.limit,
      exclude_archived: args.input.exclude_archived,
      types: "public_channel,private_channel",
    },
    ConversationsListResponseSchema,
  );
  if (!res.ok) return res;

  const channels = res.data.channels.map((c) => ({
    id: c.id,
    name: c.name ?? null,
    isPrivate: c.is_private ?? false,
  }));
  return {
    ok: true,
    data: { summary: `Listed ${channels.length} channel(s)`, data: { channels } },
  };
}

export const listChannelsAction: SlackActionDescriptor<ListChannelsInput> = {
  name: "list_channels",
  description:
    "List Slack channels the connected app can see. Read-only — runs without approval. " +
    "Payload: optional limit, exclude_archived.",
  mutates: false,
  autoApproveEligibleByDefault: true,
  inputSchema: ListChannelsInputSchema,
  dryRunSummary,
  auditFields,
  execute,
};
