// scout.ts — the Phase 1 Lead Scout orchestrator (the paste-a-URL-list flow).
//
// Given a source and its screened URLs, for each URL it: fetches the rendered page through Bright
// Data's Web Unlocker, extracts a structured profile with Claude Sonnet against the source's
// extraction pattern, classifies the fit with a cheap Haiku call, writes a brain note, and records a
// lead row. When the batch finishes it stages a Mission Control `lead_scout_batch` card with the
// tally + a CSV link. Every per-URL failure is recorded on its own lead row (status='failed') so one
// bad page never sinks the batch, and there's no silent catch anywhere in the path.

import { createInboxItem } from "@/lib/pa-inbox-items";
import { commitBrainTextFile } from "@/lib/brain/absorb";
import { fetchViaUnlocker } from "./brightdata";
import { extractProfile, htmlToText } from "./extract";
import { classifyLead } from "./classify";
import { createRun, finishRun, insertLead } from "./runs";
import { CLASSIFICATION_LABEL, slug, topLeadsBlock } from "./card";
import {
  batchUrlCap,
  emptyBreakdown,
  type ConfigWarning,
  type LeadBreakdown,
  type LeadClassification,
  type LeadScoutRun,
  type LeadScoutSource,
} from "./types";

// How many URLs we process at once. Small enough to be polite to Bright Data + the owner's Anthropic
// rate limit, large enough that a batch of a few dozen finishes in a sensible window.
const CONCURRENCY = 4;

type PaUserLite = {
  brain_repo: string | null;
  github_token: string | null;
  anthropic_api_key: string | null;
};

type LeadOutcome = {
  url: string;
  domain: string;
  name: string;
  contact: string;
  summary: string;
  classification: LeadClassification;
  status: "extracted" | "failed";
};

function buildBrainNote(params: {
  sourceName: string;
  url: string;
  classification: LeadClassification;
  profile: { name: string; contact: string; summary: string; fields: Record<string, string> };
  pageText: string;
}): string {
  const fieldLines = Object.entries(params.profile.fields)
    .map(([k, v]) => `- **${k}:** ${v || "—"}`)
    .join("\n");
  const date = new Date().toISOString().slice(0, 10);
  return [
    `# ${params.profile.name || params.url}`,
    "",
    `*Lead Scout — source "${params.sourceName}", captured ${date}*`,
    "",
    `- **URL:** ${params.url}`,
    `- **Fit:** ${CLASSIFICATION_LABEL[params.classification]}`,
    `- **Contact:** ${params.profile.contact || "—"}`,
    "",
    `**What they do:** ${params.profile.summary || "—"}`,
    "",
    fieldLines ? `**Extracted**\n\n${fieldLines}` : "",
    "",
    "---",
    "",
    "**Page text (as fetched)**",
    "",
    "```",
    params.pageText.slice(0, 8000),
    "```",
    "",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

// Process one URL end-to-end. Always inserts exactly one lead row (extracted or failed) and returns
// its outcome for the tally. Brain-write failures degrade the lead to brain_path=null but still keep
// the structured row — the data isn't lost just because the commit hiccupped.
async function processUrl(params: {
  url: string;
  domain: string;
  source: LeadScoutSource;
  runId: string;
  ownerId: string;
  brightDataKey: string;
  paUser: PaUserLite;
}): Promise<LeadOutcome> {
  const { url, domain, source, runId, ownerId, brightDataKey, paUser } = params;

  const failOutcome = (): LeadOutcome => ({
    url,
    domain,
    name: "",
    contact: "",
    summary: "",
    classification: "needs_research",
    status: "failed",
  });

  const fetched = await fetchViaUnlocker({ apiKey: brightDataKey, url });
  if (!fetched.ok) {
    await insertLead({
      runId,
      sourceId: source.id,
      ownerId,
      url,
      domain,
      name: "",
      contact: "",
      summary: "",
      profile: {},
      classification: "needs_research",
      brainPath: null,
      status: "failed",
      error: fetched.error,
    });
    return failOutcome();
  }

  if (!paUser.anthropic_api_key) {
    await insertLead({
      runId,
      sourceId: source.id,
      ownerId,
      url,
      domain,
      name: "",
      contact: "",
      summary: "",
      profile: {},
      classification: "needs_research",
      brainPath: null,
      status: "failed",
      error: "No Anthropic API key — add one in Settings to extract profiles.",
    });
    return failOutcome();
  }

  const extracted = await extractProfile({
    apiKey: paUser.anthropic_api_key,
    html: fetched.html,
    extractionPattern: source.extraction_pattern,
    url,
  });
  if (!extracted.ok) {
    await insertLead({
      runId,
      sourceId: source.id,
      ownerId,
      url,
      domain,
      name: "",
      contact: "",
      summary: "",
      profile: {},
      classification: "needs_research",
      brainPath: null,
      status: "failed",
      error: extracted.error,
    });
    return failOutcome();
  }

  const classification = await classifyLead({
    apiKey: paUser.anthropic_api_key,
    extractionPattern: source.extraction_pattern,
    profile: extracted.profile,
  });

  // Write the brain note (best-effort — a commit failure keeps the lead, just without a brain path).
  let brainPath: string | null = null;
  if (paUser.brain_repo && paUser.github_token) {
    const date = new Date().toISOString().slice(0, 10);
    const path = `brain/leads/url-list/${date}-${slug(source.name)}/${domain || "page"}.md`;
    const note = buildBrainNote({
      sourceName: source.name,
      url,
      classification,
      profile: extracted.profile,
      pageText: htmlToText(fetched.html),
    });
    const commit = await commitBrainTextFile({
      repo: paUser.brain_repo,
      token: paUser.github_token,
      path,
      content: note,
      commitMessage: `Pocket Agent — Lead Scout: ${extracted.profile.name || domain}`,
    });
    if (commit.ok) brainPath = path;
  }

  await insertLead({
    runId,
    sourceId: source.id,
    ownerId,
    url,
    domain,
    name: extracted.profile.name,
    contact: extracted.profile.contact,
    summary: extracted.profile.summary,
    profile: extracted.profile.fields,
    classification,
    brainPath,
    status: "extracted",
    error: null,
  });

  return {
    url,
    domain,
    name: extracted.profile.name,
    contact: extracted.profile.contact,
    summary: extracted.profile.summary,
    classification,
    status: "extracted",
  };
}

// Fixed-size worker pool over the URL list (order-preserving results).
async function runPool(
  items: { url: string; domain: string }[],
  worker: (item: { url: string; domain: string }) => Promise<LeadOutcome>,
): Promise<LeadOutcome[]> {
  const results: LeadOutcome[] = new Array(items.length);
  let cursor = 0;
  async function lane(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => lane()));
  return results;
}

function buildCardBody(params: {
  breakdown: LeadBreakdown;
  outcomes: LeadOutcome[];
}): string {
  const b = params.breakdown;
  const breakdownLine = `${b.hot} hot · ${b.warm} warm · ${b.cold} cold · ${b.wrong_fit} wrong-fit · ${b.needs_research} needs research`;
  const block = topLeadsBlock(
    params.outcomes
      .filter((o) => o.status === "extracted")
      .map((o) => ({
        name: o.name,
        domain: o.domain,
        summary: o.summary,
        url: o.url,
        classification: o.classification,
      })),
  );
  return [breakdownLine, "", block].join("\n");
}

export type ScoutResult =
  | { ok: true; run: LeadScoutRun }
  | { ok: false; status: number; error: string };

/**
 * Run a full scrape pass. Caps the URL list to the tier ceiling, creates the run, processes each URL
 * through the pool, finishes the run with the tally, and stages the Mission Control batch card.
 */
export async function runScout(params: {
  source: LeadScoutSource;
  ownerId: string;
  paUser: PaUserLite;
  brightDataKey: string;
  urls: { url: string; domain: string }[];
  configWarnings: ConfigWarning[];
  isPaid: boolean;
}): Promise<ScoutResult> {
  const cap = batchUrlCap(params.isPaid);
  const capped = params.urls.slice(0, cap);
  const overflowWarnings: ConfigWarning[] =
    params.urls.length > cap
      ? params.urls.slice(cap).map((u) => ({
          url: u.url,
          reason: `Over the ${cap}-URL per-batch cap on your plan — skipped this run.`,
        }))
      : [];
  const allWarnings = [...params.configWarnings, ...overflowWarnings];

  const created = await createRun({
    sourceId: params.source.id,
    ownerId: params.ownerId,
    urlCount: capped.length,
    configWarnings: allWarnings,
  });
  if (!created.ok) return { ok: false, status: created.status, error: created.error };
  const run = created.data;

  const outcomes = await runPool(capped, (item) =>
    processUrl({
      url: item.url,
      domain: item.domain,
      source: params.source,
      runId: run.id,
      ownerId: params.ownerId,
      brightDataKey: params.brightDataKey,
      paUser: params.paUser,
    }),
  );

  const breakdown = emptyBreakdown();
  let leadCount = 0;
  for (const o of outcomes) {
    if (o.status !== "extracted") continue;
    leadCount += 1;
    breakdown[o.classification] += 1;
  }

  const finished = await finishRun({
    runId: run.id,
    status: "completed",
    leadCount,
    breakdown,
  });
  if (!finished.ok) return { ok: false, status: finished.status, error: finished.error };

  // Stage the Mission Control batch card (kind='lead_scout_batch'). Best-effort — a staging failure
  // doesn't undo the run, which is already saved; the run page still shows everything.
  await createInboxItem({
    userId: params.ownerId,
    kind: "lead_scout_batch",
    title: `${params.source.name} — ${leadCount} ${leadCount === 1 ? "lead" : "leads"}`,
    bodyMd: buildCardBody({ breakdown, outcomes }),
    source: "lead-scout",
    payload: {
      runId: run.id,
      sourceId: params.source.id,
      sourceName: params.source.name,
      projectId: params.source.project_id,
      leadCount,
      breakdown,
      csvPath: `/api/app/apps/lead-scout/runs/${run.id}/csv`,
      runPath: `/api/app/apps/lead-scout/runs/${run.id}`,
    },
  });

  return { ok: true, run: { ...run, status: "completed", lead_count: leadCount, breakdown } };
}
