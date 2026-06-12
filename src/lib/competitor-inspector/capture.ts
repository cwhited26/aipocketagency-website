// capture.ts — the Inspector's end-to-end capture: run the extraction worker, generate the
// profile (one metered model call on the DNA only), hold everything on the run row, and stage
// the brain commit as an approval card (the existing stageConnectorAction plumbing — the owner
// sees the profile before it lands in their brain).

import { stageConnectorAction } from "@/lib/orchestrator/tool-use";
import { runUrlExtraction } from "@/lib/url-extraction/worker";
import { updateExtractionRow } from "@/lib/url-extraction/db";
import { sourceSlugFromUrl } from "@/lib/url-extraction/types";
import { buildCompetitorProfileMd } from "./profile";
import { generateProfileProse } from "./summary";
import {
  BRAIN_COMMIT_SCOPE,
  BRAIN_CONNECTOR,
  COMMIT_PROFILE_ACTION,
  extractionLogPathFor,
  profilePathFor,
  type CommitProfilePayload,
} from "./types";

export type CaptureOutcome =
  | { ok: true; extractionId: string; profilePath: string; inboxItemId: string }
  | { ok: false; error: string; extractionId?: string };

/**
 * Capture one competitor URL for an owner. Synchronous — the caller holds the request open while
 * the worker runs (the route carries maxDuration for it). Never throws.
 */
export async function captureCompetitor(params: {
  ownerId: string;
  url: string;
  note: string | null;
  anthropicApiKey: string | null;
}): Promise<CaptureOutcome> {
  const run = await runUrlExtraction({ ownerId: params.ownerId, url: params.url, note: params.note });
  if (!run.ok) {
    return { ok: false, error: run.error, ...(run.extractionId ? { extractionId: run.extractionId } : {}) };
  }

  const { dna, source } = run.result;
  const sourceSlug = sourceSlugFromUrl(source.final_url || params.url);
  const profilePath = profilePathFor(sourceSlug);
  const logPath = extractionLogPathFor(sourceSlug);

  const prose = await generateProfileProse({
    apiKey: params.anthropicApiKey,
    dna,
    source,
    cost: {
      ownerId: params.ownerId,
      featureSlug: "competitor_inspector",
      idempotencyKey: `competitor-inspector:${run.extractionId}:summary`,
    },
  });

  // Screenshot refs in the frontmatter point at the paths the commit will create.
  const sourceWithRefs = {
    ...source,
    screenshots: run.result.screenshots.map((s) => `screenshots/${s.name}`),
  };

  const profileMd = buildCompetitorProfileMd({
    sourceSlug,
    dna,
    source: sourceWithRefs,
    ownerNote: params.note,
    prose,
  });

  const stored = await updateExtractionRow(run.extractionId, {
    profile_md: profileMd,
    dna_record_path: null, // set when the commit executes
    extraction_log_path: null,
  });
  if (!stored.ok) {
    await updateExtractionRow(run.extractionId, { status: "failed", error: stored.error });
    return { ok: false, error: "The capture ran but couldn't be saved. Try again.", extractionId: run.extractionId };
  }

  const payload: CommitProfilePayload = {
    extraction_id: run.extractionId,
    profile_path: profilePath,
    log_path: logPath,
    source_url: source.final_url,
  };

  let inboxItemId: string;
  try {
    const staged = await stageConnectorAction({
      userId: params.ownerId,
      subAgentRunId: null,
      connector: BRAIN_CONNECTOR,
      action: COMMIT_PROFILE_ACTION,
      payload: payload as unknown as Record<string, unknown>,
      declaredScopes: [BRAIN_COMMIT_SCOPE],
      kind: "action_approval",
      title: `Competitor profile ready: ${sourceSlug}`,
      preview:
        `**${source.title || sourceSlug}** — ${source.final_url}\n\n` +
        `${prose.offer_summary}\n\n` +
        `Approving writes the profile to your brain at \`${profilePath}\` ` +
        `(plus the extraction log and ${run.result.screenshots.length} screenshots). ` +
        `Nothing lands until you approve.`,
    });
    inboxItemId = staged.inboxItemId;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not stage the approval.";
    await updateExtractionRow(run.extractionId, { status: "failed", error: message });
    return { ok: false, error: message, extractionId: run.extractionId };
  }

  await updateExtractionRow(run.extractionId, { status: "awaiting_approval" });

  return { ok: true, extractionId: run.extractionId, profilePath, inboxItemId };
}
