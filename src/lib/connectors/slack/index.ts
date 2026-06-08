// lib/connectors/slack/index.ts — the Slack connector's action registry (SPEC v5 §9.5, roadmap
// §2.1). Exposes the five actions behind a type-erased interface so the approval middleware and
// the executor can dispatch by (action name, raw payload) without knowing each action's input
// type at the call site. Each erased action still validates its payload with the original Zod
// schema before running — fail closed on a malformed payload.

import type { SlackResult } from "@/lib/slack";
import type { SlackActionDescriptor, SlackActionResult } from "./action-types";
import { postMessageAction } from "./actions/post_message";
import { postInThreadAction } from "./actions/post_in_thread";
import { sendDmAction } from "./actions/send_dm";
import { listChannelsAction } from "./actions/list_channels";
import { listRecentMessagesAction } from "./actions/list_recent_messages";

export type { SlackActionResult } from "./action-types";

// Re-export the typed descriptors for unit tests that exercise one action's pure functions.
export {
  postMessageAction,
  postInThreadAction,
  sendDmAction,
  listChannelsAction,
  listRecentMessagesAction,
};

/** A schema-validation result for a payload, surfaced by the erased dry-run path. */
type PayloadParse = { ok: true; summary: string } | { ok: false; error: string };

/** Type-erased action: dispatchable by name with an unknown payload. */
export type ErasedSlackAction = {
  name: string;
  description: string;
  mutates: boolean;
  autoApproveEligibleByDefault: boolean;
  /** Validate + render the approval-card preview for a raw payload (no network). */
  dryRunFromPayload: (raw: unknown) => PayloadParse;
  /** Validate the payload and run the Web API call with a fresh token. */
  runFromPayload: (token: string, raw: unknown) => Promise<SlackResult<SlackActionResult>>;
};

function erase<I>(d: SlackActionDescriptor<I>): ErasedSlackAction {
  return {
    name: d.name,
    description: d.description,
    mutates: d.mutates,
    autoApproveEligibleByDefault: d.autoApproveEligibleByDefault,
    dryRunFromPayload: (raw) => {
      const parsed = d.inputSchema.safeParse(raw);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payload" };
      return { ok: true, summary: d.dryRunSummary(parsed.data) };
    },
    runFromPayload: async (token, raw) => {
      const parsed = d.inputSchema.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          status: 422,
          error: parsed.error.issues[0]?.message ?? "Invalid payload",
          authError: false,
        };
      }
      return d.execute({ token, input: parsed.data });
    },
  };
}

export const SLACK_ACTIONS: ErasedSlackAction[] = [
  erase(postMessageAction),
  erase(postInThreadAction),
  erase(sendDmAction),
  erase(listChannelsAction),
  erase(listRecentMessagesAction),
];

const BY_NAME = new Map<string, ErasedSlackAction>(SLACK_ACTIONS.map((a) => [a.name, a]));

export function getSlackAction(name: string): ErasedSlackAction | undefined {
  return BY_NAME.get(name);
}

/** Write actions (approval-gated) — the names the rate cap and gating logic key on. */
export const SLACK_WRITE_ACTIONS: readonly string[] = SLACK_ACTIONS.filter((a) => a.mutates).map(
  (a) => a.name,
);

/** Read actions (auto-approve eligible by default). */
export const SLACK_READ_ACTIONS: readonly string[] = SLACK_ACTIONS.filter((a) => !a.mutates).map(
  (a) => a.name,
);
