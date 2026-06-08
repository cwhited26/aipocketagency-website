// lib/connectors/slack/draft.ts — drafter sub-agent behavior for Slack (roadmap §2.1).
//
// When PA drafts a Slack reply to a thread the owner is viewing, the channel + thread_ts come
// from the SOURCE SURFACE (the message being acted on), mirroring the Inbox sourceSurface
// pattern (web `e647592`) — the drafter never free-types a channel from untrusted content. If
// the source thread context is missing, we REFUSE here with a clear error instead of silently
// posting a top-level message to the wrong place. Pure + synchronous so it's unit-tested.

import { z } from "zod";

/** The originating Slack context handed to the drafter from the surface the owner is on. */
export const SlackSourceSurfaceSchema = z.object({
  channel: z.string().min(1).optional(),
  // The parent message ts of the thread the owner is replying to.
  thread_ts: z.string().min(1).optional(),
});
export type SlackSourceSurface = z.infer<typeof SlackSourceSurfaceSchema>;

export class SlackDraftContextError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string) {
    super(`SlackDraftContext: ${userMessage}`);
    this.name = "SlackDraftContextError";
    this.userMessage = userMessage;
  }
}

export type SlackThreadReplyDraft = {
  action: "post_in_thread";
  payload: { channel: string; thread_ts: string; text: string };
};

/**
 * Build a post_in_thread payload from the source surface + drafted text. Throws
 * SlackDraftContextError (clear, owner-facing) when the channel or thread_ts is missing — the
 * "send action refuses" requirement. The caller stages the returned payload through the
 * approval middleware exactly like any other write.
 */
export function buildThreadReplyDraft(
  source: SlackSourceSurface,
  text: string,
): SlackThreadReplyDraft {
  if (!source.channel) {
    throw new SlackDraftContextError(
      "I can't draft a Slack reply — there's no source channel in the thread you're viewing.",
    );
  }
  if (!source.thread_ts) {
    throw new SlackDraftContextError(
      "I can't draft a Slack thread reply — the source thread is missing its timestamp. " +
        "Open the thread you want me to reply in and try again.",
    );
  }
  return {
    action: "post_in_thread",
    payload: { channel: source.channel, thread_ts: source.thread_ts, text },
  };
}
