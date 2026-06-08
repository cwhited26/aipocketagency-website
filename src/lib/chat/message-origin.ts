// lib/chat/message-origin.ts — the contract for where a conversation message came in from, when
// it wasn't typed in the Ask box. Rides in pocket_agent_messages.metadata (migration 034), the
// same jsonb the upload card uses; a given message carries one or the other, never both.
//
// Today the only off-app origin is an inbound Slack message (PA-SLACK-DM-1): the owner DMs the bot
// or @mentions it, the agent answers in-place, and the user turn renders with a "Slack" chip so the
// thread shows the message arrived from outside the app. One Zod source of truth so a drifted blob
// fails validation and degrades to a plain bubble instead of crashing the thread.

import { z } from "zod";

export const SLACK_ORIGIN_KIND = "slack_origin" as const;

export const SlackOriginSchema = z.object({
  kind: z.literal(SLACK_ORIGIN_KIND),
  /** "im" = a DM to the bot; "channel" = an @mention in a channel. Drives the chip label. */
  surface: z.enum(["im", "channel"]),
});
export type SlackOrigin = z.infer<typeof SlackOriginSchema>;

/** Build the metadata blob stamped on an inbound Slack user message. */
export function slackOrigin(surface: SlackOrigin["surface"]): SlackOrigin {
  return { kind: SLACK_ORIGIN_KIND, surface };
}

/** Safe-parses message.metadata into a Slack origin, or null if it isn't one. */
export function asSlackOrigin(metadata: unknown): SlackOrigin | null {
  const parsed = SlackOriginSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}
