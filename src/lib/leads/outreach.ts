// outreach.ts — the Phase 3 Lead Scout outreach loop.
//
// Turns scraped leads (from the Phase 1 URL-list scout or the Phase 2 Google Maps sweep) into
// personalized drafts in the owner's voice, staged in Mission Control for one tap. The generation
// rides the shipped Email Drafter's voice loader (generateOutreachDraft in pa-drafts.ts → the same
// buildMemoryBlocks the Email Drafter uses), so the owner's voice carries through with no duplicate
// loading. Each draft stages as the shipped 'draft' inbox kind (source='email-drafter'), so Approve
// & Send routes straight through the existing Gmail send path with no new approval plumbing.
//
// Idempotent per lead: a lead carries outreach_drafted_at once a draft has been staged for it, and
// the batch generator skips any lead already stamped — re-running "Draft outreach" never double-drafts.

import { createInboxItem } from "@/lib/pa-inbox-items";
import { generateOutreachDraft, type OutreachTone } from "@/lib/pa-drafts";
import { getLead, listLeadsForRun, stampOutreachDrafted } from "./runs";
import type { LeadClassification, LeadScoutLead } from "./types";

type PaUserLite = {
  anthropic_api_key: string | null;
  brain_repo: string | null;
  github_token: string | null;
};

export const DEFAULT_OUTREACH_CLASSIFICATIONS: readonly LeadClassification[] = ["hot", "warm"];

export type StagedDraft = {
  leadId: string;
  leadName: string;
  recipient: string;
  subject: string;
  bodyPreview: string;
  inboxItemId: string;
};

type OutreachResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

// Best-effort recipient: prefer an explicit email field, then the lead's contact column, then any
// email anywhere in the profile. Returns "" when the lead has no email (a no-website business often
// only has a phone) — the draft still stages and the owner fills the address in the card.
export function recipientFor(lead: LeadScoutLead): string {
  const profile = lead.profile ?? {};
  const candidates: unknown[] = [profile.email, profile.contact_email, lead.contact];
  for (const c of candidates) {
    if (typeof c === "string") {
      const m = c.match(EMAIL_RE);
      if (m) return m[0];
    }
  }
  for (const v of Object.values(profile)) {
    if (typeof v === "string") {
      const m = v.match(EMAIL_RE);
      if (m) return m[0];
    }
  }
  return "";
}

// Flatten the lead's profile jsonb to the plain-string map the drafter reads.
export function profileStrings(lead: LeadScoutLead): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(lead.profile ?? {})) {
    if (v === null || v === undefined || v === "") continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

/**
 * Generate outreach for one lead (pure generation — no staging). Pulls the lead's structured profile
 * and the owner's PA profile, then drafts in the owner's voice with the tone hint. Returns the
 * subject + body + citations, per the SPEC §7.5 contract.
 */
export async function generateOutreachForLead(params: {
  leadId: string;
  ownerId: string;
  paUser: PaUserLite;
  tone?: OutreachTone;
  sourceName: string;
  /** Vertical voice hint from the source's pack (Phase 4); steers the angle without overriding voice. */
  voiceBrief?: string;
}): Promise<OutreachResult<{ subject: string; body: string; citations: { file: string; line: string }[]; lead: LeadScoutLead; recipient: string }>> {
  if (!params.paUser.anthropic_api_key) {
    return { ok: false, status: 402, error: "no_api_key" };
  }

  const found = await getLead(params.leadId, params.ownerId);
  if (!found.ok) return { ok: false, status: found.status, error: found.error };
  const lead = found.data;
  if (!lead) return { ok: false, status: 404, error: "Lead not found" };

  const draft = await generateOutreachDraft(
    {
      leadName: lead.name || lead.domain,
      leadSummary: lead.summary,
      leadProfile: profileStrings(lead),
      leadUrl: lead.url,
      sourceName: params.sourceName,
      tone: params.tone ?? "cold-introduce",
      voiceBrief: params.voiceBrief,
    },
    params.paUser.anthropic_api_key,
    params.paUser.brain_repo,
    params.paUser.github_token,
    {
      ownerId: params.ownerId,
      featureSlug: "email_drafter",
      idempotencyKey: `outreach:${params.ownerId}:${params.leadId}`,
    },
  );

  return {
    ok: true,
    data: {
      subject: draft.subject,
      body: draft.body,
      citations: draft.citations,
      lead,
      recipient: recipientFor(lead),
    },
  };
}

// Stage one lead's outreach as a 'draft' inbox card (source='email-drafter' → Approve & Send routes
// through the Gmail send path). Stamps outreach_drafted_at first so a concurrent run can't double
// up; if the stamp was already claimed and `force` is off, this is a no-op.
async function stageOutreachForLead(params: {
  lead: LeadScoutLead;
  ownerId: string;
  paUser: PaUserLite;
  tone?: OutreachTone;
  sourceName: string;
  voiceBrief?: string;
  force?: boolean;
}): Promise<OutreachResult<StagedDraft | null>> {
  if (!params.force && params.lead.outreach_drafted_at) {
    return { ok: true, data: null }; // already drafted — idempotent skip
  }

  // Claim the lead before spending an Anthropic call, so two concurrent batches don't both draft it.
  if (!params.force) {
    const claim = await stampOutreachDrafted(params.lead.id, params.ownerId);
    if (!claim.ok) return { ok: false, status: claim.status, error: claim.error };
    if (!claim.data) return { ok: true, data: null }; // lost the race — another stage has it
  }

  const generated = await generateOutreachForLead({
    leadId: params.lead.id,
    ownerId: params.ownerId,
    paUser: params.paUser,
    tone: params.tone,
    sourceName: params.sourceName,
    voiceBrief: params.voiceBrief,
  });
  if (!generated.ok) return { ok: false, status: generated.status, error: generated.error };

  const { subject, body, citations, recipient, lead } = generated.data;
  const leadName = lead.name || lead.domain || "this lead";
  const finalSubject = subject || `A quick note for ${leadName}`;

  const staged = await createInboxItem({
    userId: params.ownerId,
    kind: "draft",
    title: `Outreach to ${leadName}`,
    bodyMd: body,
    source: "email-drafter",
    payload: {
      to: recipient,
      subject: finalSubject,
      body,
      citations,
      sourceSurface: "lead-scout",
      leadId: lead.id,
      runId: lead.run_id,
    },
  });
  if (!staged.ok) return { ok: false, status: staged.status, error: staged.error };

  // Stamp for the force path (the non-force path already claimed it above).
  if (params.force) await stampOutreachDrafted(lead.id, params.ownerId);

  return {
    ok: true,
    data: {
      leadId: lead.id,
      leadName,
      recipient,
      subject: finalSubject,
      bodyPreview: body.replace(/\s+/g, " ").trim().slice(0, 160),
      inboxItemId: staged.data.id,
    },
  };
}

/**
 * Generate + stage outreach for every qualifying lead in a run. Defaults to hot + warm leads
 * (SPEC §4). Skips leads already drafted (idempotent per lead) and leads that failed to extract.
 * Returns the staged drafts plus how many were skipped, for the endpoint to report back.
 */
export async function generateOutreachForBatch(params: {
  runId: string;
  ownerId: string;
  paUser: PaUserLite;
  sourceName: string;
  classification?: LeadClassification[];
  tone?: OutreachTone;
  voiceBrief?: string;
}): Promise<OutreachResult<{ staged: StagedDraft[]; skipped: number; candidates: number }>> {
  if (!params.paUser.anthropic_api_key) {
    return { ok: false, status: 402, error: "no_api_key" };
  }

  const leadsResult = await listLeadsForRun(params.runId, params.ownerId);
  if (!leadsResult.ok) return { ok: false, status: leadsResult.status, error: leadsResult.error };

  const wanted = new Set<LeadClassification>(
    params.classification?.length ? params.classification : [...DEFAULT_OUTREACH_CLASSIFICATIONS],
  );
  const candidates = leadsResult.data.filter(
    (l) => l.status === "extracted" && wanted.has(l.classification),
  );

  const staged: StagedDraft[] = [];
  let skipped = 0;
  // Sequential: keeps the owner's Anthropic rate limit happy and the staging order warmest-first
  // when callers pre-sort. Each lead is independent; one failure doesn't sink the batch.
  for (const lead of candidates) {
    const result = await stageOutreachForLead({
      lead,
      ownerId: params.ownerId,
      paUser: params.paUser,
      tone: params.tone,
      sourceName: params.sourceName,
      voiceBrief: params.voiceBrief,
    });
    if (!result.ok) {
      // A generation/stage failure for one lead releases its claim so a later run can retry it.
      skipped += 1;
      continue;
    }
    if (result.data) staged.push(result.data);
    else skipped += 1; // already drafted / lost the race
  }

  return { ok: true, data: { staged, skipped, candidates: candidates.length } };
}

/** Single-lead stage, for the "Draft outreach for this lead" button. Forces a fresh draft. */
export async function draftOutreachForSingleLead(params: {
  leadId: string;
  ownerId: string;
  paUser: PaUserLite;
  sourceName: string;
  tone?: OutreachTone;
  voiceBrief?: string;
}): Promise<OutreachResult<StagedDraft>> {
  const found = await getLead(params.leadId, params.ownerId);
  if (!found.ok) return { ok: false, status: found.status, error: found.error };
  const lead = found.data;
  if (!lead) return { ok: false, status: 404, error: "Lead not found" };

  const result = await stageOutreachForLead({
    lead,
    ownerId: params.ownerId,
    paUser: params.paUser,
    tone: params.tone,
    sourceName: params.sourceName,
    voiceBrief: params.voiceBrief,
    force: true,
  });
  if (!result.ok) return result;
  if (!result.data) return { ok: false, status: 500, error: "Draft was not staged." };
  return { ok: true, data: result.data };
}
