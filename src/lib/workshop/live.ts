// lib/workshop/live.ts — pure helpers the workshop player + lobby client components share.
// All timestamp-driven behavior (fake-live chat, workbook auto-scroll, action buttons) resolves
// through these functions so the timing logic is unit-tested without a browser or a video element.

import {
  WORKSHOP_CHAT_SCRIPT,
  type WorkshopChatMessage,
  type WorkshopChatSegment,
} from "@/data/workshop/chat-script";
import { WORKSHOP_WORKBOOK_MAP } from "@/data/workshop/workbook-map";
import {
  WORKSHOP_ACTION_SCRIPT,
  type WorkshopAction,
  type WorkshopActionKind,
} from "@/data/workshop/action-script";

/** Seeded messages for a segment whose trigger has been crossed at `positionSec`, in order. */
export function dueChatMessages(
  segment: WorkshopChatSegment,
  positionSec: number,
  script: readonly WorkshopChatMessage[] = WORKSHOP_CHAT_SCRIPT,
): WorkshopChatMessage[] {
  return script.filter((m) => m.segment === segment && m.trigger_sec <= positionSec);
}

/** The workbook page for the current video position (last crossed entry; page 1 before any). */
export function currentWorkbookPage(positionSec: number): number {
  let page = 1;
  for (const entry of WORKSHOP_WORKBOOK_MAP) {
    if (entry.trigger_sec <= positionSec) page = entry.page_number;
    else break;
  }
  return page;
}

/** Action buttons whose trigger has been crossed, in appearance order. */
export function visibleActions(
  positionSec: number,
  script: readonly WorkshopAction[] = WORKSHOP_ACTION_SCRIPT,
): WorkshopAction[] {
  return script.filter((a) => a.trigger_sec <= positionSec);
}

/**
 * Which server call (or navigation) each action kind drives. The registry is data; this mapping is
 * the single place a kind resolves to an endpoint, so the test pinning "registry drives the correct
 * API call" tests exactly what the player executes.
 */
export function actionTarget(
  kind: WorkshopActionKind,
): { type: "api"; endpoint: string } | { type: "navigate"; hrefKind: "claude" | "app" } {
  switch (kind) {
    case "fork_repo":
      return { type: "api", endpoint: "/api/workshop/actions/fork-repo" };
    case "add_zone":
      return { type: "api", endpoint: "/api/workshop/actions/add-zone" };
    case "connect_claude":
      return { type: "navigate", hrefKind: "claude" };
    case "login_to_pa":
      return { type: "navigate", hrefKind: "app" };
  }
}

/** The Claude deep link with the attendee's forked repo pre-filled (§24.4 min-45 button). */
export function claudeConnectUrl(forkedRepoUrl: string): string {
  const q = new URLSearchParams({
    q: `Read my Business Brain at ${forkedRepoUrl} and use it as context for everything we do.`,
  });
  return `https://claude.ai/new?${q.toString()}`;
}

/** The auto-reply shown in the feed after an attendee sends a real message (§24.4 — no live moderation). */
export const CHAT_AUTO_REPLY = "Chase will address this after — great question.";
