// draft.ts — turns one dormant contact into a staged follow-up draft (PA-FUS-2, PA-FUS-3).
//
// Generation rides the shipped Email Drafter (generateEmailDraft in pa-drafts.ts → the same
// buildMemoryBlocks the Email Drafter and Lead Scout outreach both use), so the owner's voice carries
// through with zero duplicate loading and the cost lands on the ledger automatically (generateEmailDraft
// logs the pa_cost_events row when a CostContext is passed — featureSlug 'follow_up_sweeps', model
// claude-sonnet-4-6). The tone is steered per the source's relationship (TONE_BY_RELATIONSHIP).
//
// Each draft stages as the shipped 'draft' inbox kind with source='email-drafter', exactly like the
// Lead Scout outreach loop — so Approve & Send routes straight through the existing Gmail send path
// with no new approval plumbing (PA-FUS-3). Idempotent per contact: the 7-day re-draft guard skips a
// contact stamped within the cooldown unless `force` is set.

import { createInboxItem } from "@/lib/pa-inbox-items";
import { generateEmailDraft } from "@/lib/pa-drafts";
import { stampContactDrafted } from "./db";
import {
  REDRAFT_COOLDOWN_DAYS,
  toneFor,
  type FollowupSweepContact,
  type FollowupSweepSource,
} from "./types";

export type PaUserLite = {
  anthropic_api_key: string | null;
  brain_repo: string | null;
  github_token: string | null;
};

export type StagedFollowup = {
  contactId: string;
  contactEmail: string;
  contactName: string | null;
  subject: string;
  bodyPreview: string;
  inboxItemId: string;
};

type DraftResult =
  | { ok: true; data: StagedFollowup | null }
  | { ok: false; status: number; error: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when a contact was drafted within the re-draft cooldown (PA-FUS-3). */
function withinCooldown(lastDraftedAt: string | null, now: Date): boolean {
  if (!lastDraftedAt) return false;
  const last = Date.parse(lastDraftedAt);
  if (!Number.isFinite(last)) return false;
  return now.getTime() - last < REDRAFT_COOLDOWN_DAYS * DAY_MS;
}

/**
 * Draft a follow-up for one contact and stage it. Returns the staged draft, or null when the contact
 * is skipped (suppressed, or inside the 7-day cooldown and not forced). `sweepId` makes the cost
 * idempotency key deterministic per sweep run (followup:<sweepId>:<email>), so a retry of the same
 * realized cost collapses to one ledger row.
 */
export async function draftFollowupForContact(params: {
  contact: FollowupSweepContact;
  source: FollowupSweepSource;
  ownerId: string;
  paUser: PaUserLite;
  sweepId: string;
  /** The discovery note (last touch, what the source knows) — folded into the email's key points. */
  note?: string;
  force?: boolean;
}): Promise<DraftResult> {
  const { contact, source, ownerId, paUser, sweepId, note, force } = params;

  if (!paUser.anthropic_api_key) return { ok: false, status: 402, error: "no_api_key" };
  if (contact.suppressed) return { ok: true, data: null }; // left alone (PA-FUS-5)
  if (!force && withinCooldown(contact.last_drafted_at, new Date())) {
    return { ok: true, data: null }; // drafted recently — idempotent skip (PA-FUS-3)
  }

  const tone = toneFor(source.source_config.relationship);
  // The discovery note carries the real facts (last touch, brain path, lead summary). When this is a
  // manual single-contact regenerate with no fresh discovery, fall back to the stored touch date.
  const factLine =
    note ??
    (contact.last_touched_at
      ? `Last touch on record: ${contact.last_touched_at.slice(0, 10)}.`
      : "No recent touch on record.");
  const keyPoints = [
    factLine,
    `What I'm watching: ${source.source_config.label}.`,
    "Keep it short. One clear, low-friction next step. Don't invent anything not stated here.",
  ].join("\n");

  const generated = await generateEmailDraft(
    {
      recipient: contact.contact_name || contact.contact_email,
      relationship: tone.relationshipLabel,
      purpose: tone.purpose,
      keyPoints,
      tone: tone.tone,
    },
    paUser.anthropic_api_key,
    paUser.brain_repo,
    paUser.github_token,
    {
      ownerId,
      featureSlug: "follow_up_sweeps",
      idempotencyKey: `followup:${sweepId}:${contact.contact_email}`,
    },
  );

  const body = generated.draft;
  const subject = tone.subjectDefault;

  const staged = await createInboxItem({
    userId: ownerId,
    kind: "draft",
    title: `Follow-up to ${contact.contact_name || contact.contact_email}`,
    bodyMd: body,
    source: "email-drafter",
    payload: {
      to: contact.contact_email,
      subject,
      body,
      citations: generated.citations,
      sourceSurface: "follow-up-sweeps",
      followupSourceId: source.id,
      followupContactId: contact.id,
      relationship: source.source_config.relationship,
    },
  });
  if (!staged.ok) return { ok: false, status: staged.status, error: staged.error };

  // Stamp the cooldown only after the card is safely staged, so a staging failure doesn't suppress
  // a retry next sweep.
  await stampContactDrafted(contact.id, ownerId);

  return {
    ok: true,
    data: {
      contactId: contact.id,
      contactEmail: contact.contact_email,
      contactName: contact.contact_name,
      subject,
      bodyPreview: body.replace(/\s+/g, " ").trim().slice(0, 160),
      inboxItemId: staged.data.id,
    },
  };
}
