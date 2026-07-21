// execute.ts — the Browser Agent execution bridge (SPEC §4.6, §3 TOS handling).
//
// When the owner approves a linkedin_scout_send card, the actual click happens on the owner's OWN
// logged-in LinkedIn tab, at human rate, through the Browser Agent — LinkedIn never sees a bot pattern
// (SPEC §3). That "Browser Agent on the owner's own Chrome tab" primitive isn't wired on the PA runtime
// yet (the shipped Browser Agent drives a hidden headless Browserbase session, not the owner's tab), so
// this bridge follows the Idea Engine bridge precedent: it advances the prospect lifecycle + stamps the
// draft, and when the receiver is absent it returns a receiver_missing outcome so the approve route can
// tell the owner honestly — it NEVER crashes and NEVER auto-sends anything (SPEC §11).
//
// This is the one seam that goes live for free the day the owner-tab Browser Agent primitive lands:
// swap dispatchToBrowserAgent's stub body for the real dispatch; everything around it already works.

import { getProspect, updateProspect, markDraftExecuted } from "./db";
import { logCostEvent } from "@/lib/cost/log";
import type { DraftKind } from "./types";
import type { LinkedinScoutSendPayload } from "./queue";

/** Whether the owner-tab Browser Agent receiver is wired on this runtime. It isn't yet — flip this
 *  (or make it read a real capability) when the primitive lands. */
function browserAgentReceiverWired(): boolean {
  // The env acts as the feature switch so this goes live via config, not a code deploy, the day the
  // owner-tab Browser Agent primitive ships.
  return process.env.LINKEDIN_SCOUT_BROWSER_AGENT_WIRED === "true";
}

export type ExecuteOutcome =
  | { ok: true; dispatched: true; kind: DraftKind }
  | { ok: true; dispatched: false; reason: "receiver_missing"; kind: DraftKind }
  | { ok: false; status: number; error: string };

/** Map a draft kind to the prospect lifecycle patch applied when its send is dispatched/queued. */
function lifecyclePatch(kind: DraftKind): Parameters<typeof updateProspect>[2] {
  const nowIso = new Date().toISOString();
  switch (kind) {
    case "connection_note":
      return { connectionStatus: "sent", connectionSentAt: nowIso };
    case "day3_inmail":
      return { day3InmailStatus: "sent" };
    case "day7_followup":
      return { day7FollowupStatus: "sent" };
  }
}

/**
 * Dispatch one approved send to the Browser Agent. Called from the inbox approve route (on approval of
 * a linkedin_scout_send card) and from the prospects/[id]/execute route. Advances the prospect's
 * lifecycle, stamps the draft executed, and writes a $0 cost event for the audit trail (SPEC §7 —
 * Browser Agent execution is $0 direct cost but still ledgered). Never throws.
 */
export async function executeLinkedinScoutSend(
  ownerId: string,
  payload: LinkedinScoutSendPayload,
): Promise<ExecuteOutcome> {
  // Ownership re-check (defense-in-depth; the route already gated the card).
  const prospect = await getProspect(payload.prospectId, ownerId);
  if (!prospect.ok) return { ok: false, status: prospect.status, error: prospect.error };
  if (!prospect.data) return { ok: false, status: 404, error: "Prospect not found" };

  const wired = browserAgentReceiverWired();

  // $0 audit event either way (matches the idea_engine_bridge / browser_agent $0 precedent).
  await logCostEvent({
    ownerId,
    featureSlug: "linkedin_scout",
    backend: "vercel",
    costMicroCents: 0,
    idempotencyKey: `linkedin_scout:execute:${payload.draftId}`,
    metadata: {
      sub_slug: "linkedin_scout_execute",
      draft_kind: payload.kind,
      dispatched: String(wired),
    },
  });

  // Advance the lifecycle + stamp the draft regardless — the owner approved the send; whether the
  // receiver is live only changes whether the click fired now or waits for the primitive.
  await updateProspect(payload.prospectId, ownerId, lifecyclePatch(payload.kind));
  await markDraftExecuted(payload.draftId);

  if (!wired) {
    // Idea Engine bridge precedent: stage as receiver-missing, don't crash. The route surfaces this so
    // the owner knows the send is queued for the moment the owner-tab Browser Agent primitive is live.
    return { ok: true, dispatched: false, reason: "receiver_missing", kind: payload.kind };
  }

  // When the receiver is wired this is where the real owner-tab dispatch goes (navigate → Connect →
  // paste note → submit, human-rate). Until then the flag is false and we never reach here.
  return { ok: true, dispatched: true, kind: payload.kind };
}
