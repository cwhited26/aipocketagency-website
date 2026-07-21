// orchestrate.ts — the shortlist → research → draft → queue chain (SPEC §4.3–§4.4, §12).
//
// The shortlist route hands this the candidates the owner ticked. For each: persist it as a prospect,
// write the 3-line brief (brief.ts, metered), generate the three drafts (draft.ts, voice-checked + the
// two-strike retry), and stage each draft as its own Approval Queue card (queue.ts). The owner's brain
// (offer + voice) loads ONCE and threads through both the brief and the drafts, so a shortlist of 20
// prospects reads the brain once, not 80 times.
//
// Sequential per prospect (keeps the owner's Anthropic rate limit happy + the cards land warmest-first
// when the caller pre-sorts). One prospect failing doesn't sink the batch.

import { buildMemoryBlocks, type MemoryBlock } from "@/lib/pa-brain";
import { writeBrief } from "./brief";
import { generateAllDrafts } from "./draft";
import { queueDraftsForProspect } from "./queue";
import { upsertProspect, updateProspect } from "./db";
import type { CompleteFn } from "./llm";
import type { EnrichmentSignals, ShortlistInput } from "./types";

/** Compact the owner's brain memory to a single string the brief + draft prompts read. Bounded so a
 *  huge brain doesn't blow the prompt — the voice spec + offer files are what matter here. */
function brainToContext(blocks: MemoryBlock[], maxChars = 12_000): string {
  const joined = blocks.map((b) => `--- ${b.path} ---\n${b.content}`).join("\n\n");
  return joined.length > maxChars ? joined.slice(0, maxChars) : joined;
}

/** Pull the scoreable signals back off a stored enrichment snapshot — the shortlist carries the raw
 *  snapshot, and the fit-score signals were computed at search time; re-read what the brief/draft need. */
function signalsFromSnapshot(snapshot: Record<string, unknown>): EnrichmentSignals {
  const s = (snapshot?.signals ?? snapshot) as Record<string, unknown>;
  const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
  const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
  return {
    title: str(s.title),
    seniority: str(s.seniority),
    industry: str(s.industry),
    companySize: str(s.companySize ?? s.company_size),
    location: str(s.location),
    recentJobMove: s.recentJobMove === true || s.recent_job_change === true,
    recentPostActivity: s.recentPostActivity === true || s.has_recent_activity === true,
    mutualConnections: num(s.mutualConnections ?? s.mutual_connections),
  };
}

export type ShortlistSummary = {
  prospects: number;
  cardsQueued: number;
  cardsSkipped: number;
  failures: number;
};

/**
 * Run the full shortlist chain. `complete` is the metered LLM (llm.ts); `paUser` carries the brain repo
 * + token so the brain loads once. Returns a summary the route reports back.
 */
export async function shortlistProspects(params: {
  ownerId: string;
  runId: string;
  input: ShortlistInput;
  complete: CompleteFn;
  brainRepo: string | null;
  githubToken: string | null;
}): Promise<ShortlistSummary> {
  const blocks: MemoryBlock[] = params.brainRepo
    ? await buildMemoryBlocks(params.brainRepo, params.githubToken).catch(() => [])
    : [];
  const brainContext = brainToContext(blocks);

  const summary: ShortlistSummary = { prospects: 0, cardsQueued: 0, cardsSkipped: 0, failures: 0 };

  for (const cand of params.input.candidates) {
    const stored = await upsertProspect({
      runId: params.runId,
      ownerId: params.ownerId,
      linkedinProfileUrl: cand.linkedinProfileUrl,
      fullName: cand.fullName,
      headline: cand.headline,
      company: cand.company,
      fitScore: cand.fitScore,
      enrichmentSource: cand.enrichmentSource,
      enrichmentSnapshot: cand.enrichmentSnapshot,
    });
    if (!stored.ok) {
      summary.failures += 1;
      continue;
    }
    const prospect = stored.data;
    summary.prospects += 1;
    const signals = signalsFromSnapshot(cand.enrichmentSnapshot);

    // Research (metered, sub-slug linkedin_scout_research).
    const briefRes = await writeBrief(
      {
        fullName: prospect.full_name,
        headline: prospect.headline,
        company: prospect.company,
        signals,
        snapshot: cand.enrichmentSnapshot,
        brainContext,
      },
      params.complete,
      { ownerId: params.ownerId, idempotencyKey: `linkedin_scout:brief:${prospect.id}` },
    );
    await updateProspect(prospect.id, params.ownerId, { brief: briefRes.brief });
    const prospectWithBrief = { ...prospect, brief: briefRes.brief };

    // Draft (metered, sub-slug linkedin_scout_draft) + voice-check + queue as approval cards.
    const drafts = await generateAllDrafts(
      {
        fullName: prospect.full_name,
        headline: prospect.headline,
        company: prospect.company,
        brief: briefRes.brief,
        signals,
        brainContext,
      },
      params.complete,
      { ownerId: params.ownerId, prospectId: prospect.id },
    );
    const staged = await queueDraftsForProspect(prospectWithBrief, drafts);
    summary.cardsQueued += staged.queued.length;
    summary.cardsSkipped += staged.skipped.length;
  }

  return summary;
}
