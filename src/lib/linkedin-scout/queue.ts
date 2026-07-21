// queue.ts — stage each draft as its own Approval Queue card (SPEC §4.4, §11).
//
// Every draft becomes one pa_inbox_items row with kind 'linkedin_scout_send', keyed to prospect_id +
// draft kind. NEVER a batch card, never "approve all" — one send is one card, one tap (SPEC §3, §11).
// The draft row's agent_pending_action_id points back at the card. The card's payload carries what the
// execute bridge needs at approval time (the profile URL, the kind, the body) so the approve route can
// hand it to the Browser Agent without re-reading the draft.
//
// NOTE on the "/agent Approval Queue": the SPEC names pa_pending_actions; in this codebase the shipped
// Approval Queue surface is pa_inbox_items (what Lead Scout, Email Drafter, Browser Agent all stage
// into). We stage there so the card renders in the existing /agent UI with no new plumbing.

import { createInboxItem } from "@/lib/pa-inbox-items";
import { upsertDraft, linkDraftPendingAction } from "./db";
import type { GeneratedDraft } from "./draft";
import type { DraftKind, LinkedinScoutProspect } from "./types";

/** The pa_inbox_items kind + source LinkedIn Scout send cards use. */
export const LINKEDIN_SCOUT_SEND_KIND = "linkedin_scout_send" as const;
export const LINKEDIN_SCOUT_SOURCE = "linkedin-scout" as const;

/** Human title per draft kind, for the card. */
const CARD_TITLE: Record<DraftKind, (name: string) => string> = {
  connection_note: (n) => `Send LinkedIn connection request to ${n}`,
  day3_inmail: (n) => `Send day-3 InMail to ${n}`,
  day7_followup: (n) => `Send day-7 follow-up to ${n}`,
};

/** The payload the execute bridge reads at approval time. Everything it needs to act on the owner's
 *  own browser without re-reading the DB. */
export type LinkedinScoutSendPayload = {
  prospectId: string;
  draftId: string;
  kind: DraftKind;
  linkedinProfileUrl: string;
  fullName: string;
  body: string;
  voiceFlags: string;
};

export type QueuedCard = { draftId: string; inboxItemId: string; kind: DraftKind };

type QueueResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/**
 * Persist one draft and stage its Approval Queue card. Idempotent on (prospect, kind) via upsertDraft;
 * a re-queue replaces the draft body and stages a fresh card. Returns the card id so the caller can
 * report it. A voice_warning (from the two-strike retry) rides through onto the card via the body and
 * the payload — the owner still sees it, flagged.
 */
export async function queueDraft(
  prospect: LinkedinScoutProspect,
  draft: GeneratedDraft,
): Promise<QueueResult<QueuedCard>> {
  // Empty body = the generator gave up on this kind; skip staging a blank card, surface it as a skip.
  if (!draft.body.trim()) {
    return { ok: false, status: 422, error: `empty draft for ${draft.kind}` };
  }

  const stored = await upsertDraft({
    prospectId: prospect.id,
    ownerId: prospect.owner_id,
    kind: draft.kind,
    body: draft.body,
    voiceFlags: draft.voiceFlags,
  });
  if (!stored.ok) return { ok: false, status: stored.status, error: stored.error };

  const name = prospect.full_name || "this prospect";
  const bodyMd = draft.voiceFlags
    ? `${draft.body}\n\n> ⚠️ ${draft.voiceFlags}`
    : draft.body;

  const payload: LinkedinScoutSendPayload = {
    prospectId: prospect.id,
    draftId: stored.data.id,
    kind: draft.kind,
    linkedinProfileUrl: prospect.linkedin_profile_url,
    fullName: prospect.full_name,
    body: draft.body,
    voiceFlags: draft.voiceFlags,
  };

  const card = await createInboxItem({
    userId: prospect.owner_id,
    kind: LINKEDIN_SCOUT_SEND_KIND,
    title: CARD_TITLE[draft.kind](name),
    bodyMd,
    source: LINKEDIN_SCOUT_SOURCE,
    payload: payload as unknown as Record<string, unknown>,
  });
  if (!card.ok) return { ok: false, status: card.status, error: card.error };

  await linkDraftPendingAction(stored.data.id, card.data.id);
  return { ok: true, data: { draftId: stored.data.id, inboxItemId: card.data.id, kind: draft.kind } };
}

/** Stage every generated draft for a prospect (SPEC §4.4). One card each; a skipped/empty draft is
 *  counted, never silently dropped. */
export async function queueDraftsForProspect(
  prospect: LinkedinScoutProspect,
  drafts: GeneratedDraft[],
): Promise<{ queued: QueuedCard[]; skipped: { kind: DraftKind; reason: string }[] }> {
  const queued: QueuedCard[] = [];
  const skipped: { kind: DraftKind; reason: string }[] = [];
  for (const draft of drafts) {
    const res = await queueDraft(prospect, draft);
    if (res.ok) queued.push(res.data);
    else skipped.push({ kind: draft.kind, reason: res.error });
  }
  return { queued, skipped };
}
