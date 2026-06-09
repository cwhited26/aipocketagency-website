// google-maps-sweep.ts — the Phase 2 Lead Scout sub-pipeline (the headline use case).
//
// "Find me 47 roofers in Knoxville that don't have a website." The owner picks a category + a
// location + a radius + filters; this sweep queries Google Maps through Bright Data's SERP API
// (search_engine zone, the same POST api.brightdata.com/request primitive Phase 1's Web Unlocker
// rides — see fetchMapsViaSerp), pages until it hits the tier cap or runs dry, applies the filters
// (the no-website filter is the headline — a Facebook page is NOT a real website, PA-LS-9),
// classifies each business's fit with the same cheap Haiku call Phase 1 uses, writes a brain note per
// lead, records a lead row, and stages a Google-Maps-framed Mission Control batch card.
//
// PA-LS-5 (publicly listed business data only): a Google Maps business profile IS public data the
// business itself published — name, phone, address, whether it has a website. The sweep reads the
// public local pack only; it never logs in, never opens a private surface, and never harvests a
// personal social profile. There's no per-URL scrape of each business site (so no denylist pass is
// needed here — that's a url_list concern); the sweep stays inside Google's public results.

import { createInboxItem } from "@/lib/pa-inbox-items";
import { commitBrainTextFile } from "@/lib/brain/absorb";
import { fetchMapsViaSerp, type MapsBusiness } from "./brightdata";
import { classifyLead } from "./classify";
import { domainOf } from "./denylist";
import type { ExtractedProfile } from "./extract";
import { createRun, finishRun, insertLead } from "./runs";
import { CLASSIFICATION_LABEL, slug, topLeadsBlock } from "./card";
import {
  emptyBreakdown,
  mapsSweepCap,
  type ConfigWarning,
  type LeadBreakdown,
  type LeadClassification,
  type LeadScoutRun,
  type LeadScoutSource,
  type MapsSweepConfig,
} from "./types";

// SERP pages to pull per run (≈20 listings each). Bounds a single run's scrape cost + keeps it inside
// the serverless window; the tier cap (mapsSweepCap) is the lead ceiling, this is the page ceiling.
const MAX_PAGES = 20;
// How many businesses we classify at once — polite to Bright Data + the owner's Anthropic rate limit.
const CONCURRENCY = 4;

type PaUserLite = {
  brain_repo: string | null;
  github_token: string | null;
  anthropic_api_key: string | null;
};

type SweepOutcome = {
  business: MapsBusiness;
  classification: LeadClassification;
  url: string;
  domain: string;
};

// The synthetic "what the owner is looking for" string the classifier judges fit against — a maps
// source has no free-text extraction pattern, so we build one from its config.
function patternFor(config: MapsSweepConfig): string {
  const bits = [`${config.category} businesses near ${config.location}`];
  if (config.filters.noWebsite) bits.push("that don't have a real website yet");
  if (config.filters.minReviews != null) bits.push(`with at least ${config.filters.minReviews} reviews`);
  return `${bits.join(", ")}.`;
}

// The query string the SERP gets — category + location reads as a Google Maps local search. Radius is
// approximate (Google ranks by proximity); we carry it in the note + card, not the query.
function queryFor(config: MapsSweepConfig): string {
  return `${config.category} in ${config.location}`;
}

function businessProfile(b: MapsBusiness): ExtractedProfile {
  return {
    name: b.name,
    contact: b.phone || b.email,
    summary: [b.category, b.address].filter(Boolean).join(" · "),
    fields: {
      website: b.website || "(none)",
      phone: b.phone,
      email: b.email,
      rating: b.rating != null ? String(b.rating) : "",
      reviews: b.reviewsCount != null ? String(b.reviewsCount) : "",
      address: b.address,
      category: b.category,
    },
  };
}

// Apply the owner's filters to one listing. noWebsite is the headline — a listing with a real website
// is dropped when the owner wants only sites-needed businesses.
function passesFilters(b: MapsBusiness, config: MapsSweepConfig): boolean {
  const f = config.filters;
  if (f.noWebsite && b.website) return false;
  if (f.hasPhone && !b.phone) return false;
  if (f.hasEmail && !b.email) return false;
  if (f.minReviews != null && (b.reviewsCount ?? 0) < f.minReviews) return false;
  if (f.maxReviews != null && b.reviewsCount != null && b.reviewsCount > f.maxReviews) return false;
  return true;
}

function businessKey(b: MapsBusiness): string {
  return (b.mapsUrl || `${b.name}|${b.address}`).toLowerCase();
}

function buildBrainNote(params: {
  sourceName: string;
  config: MapsSweepConfig;
  business: MapsBusiness;
  classification: LeadClassification;
}): string {
  const b = params.business;
  const date = new Date().toISOString().slice(0, 10);
  return [
    `# ${b.name || "Business"}`,
    "",
    `*Lead Scout — Google Maps sweep "${params.sourceName}", captured ${date}*`,
    "",
    `- **Category:** ${b.category || params.config.category}`,
    `- **Fit:** ${CLASSIFICATION_LABEL[params.classification]}`,
    `- **Website:** ${b.website || "— none on the listing —"}`,
    `- **Phone:** ${b.phone || "—"}`,
    `- **Email:** ${b.email || "—"}`,
    `- **Address:** ${b.address || "—"}`,
    `- **Reviews:** ${b.reviewsCount != null ? b.reviewsCount : "—"}${b.rating != null ? ` (${b.rating}★)` : ""}`,
    `- **Maps listing:** ${b.mapsUrl || "—"}`,
    "",
    `Swept from Google Maps for ${params.config.category} within ~${params.config.radiusMiles} miles of ${params.config.location}.`,
    "",
  ].join("\n");
}

// Process one business: classify, write the brain note (best-effort), insert the lead row. Always
// inserts exactly one lead row and returns its outcome for the tally.
async function processBusiness(params: {
  business: MapsBusiness;
  source: LeadScoutSource;
  config: MapsSweepConfig;
  runId: string;
  ownerId: string;
  paUser: PaUserLite;
}): Promise<SweepOutcome> {
  const { business, source, config, runId, ownerId, paUser } = params;
  // A no-website lead still needs a link — fall back to the Maps listing URL.
  const url = business.website || business.mapsUrl;
  const domain = business.website ? domainOf(business.website) : "";

  const classification = await classifyLead({
    apiKey: paUser.anthropic_api_key,
    extractionPattern: patternFor(config),
    profile: businessProfile(business),
  });

  // Brain note (best-effort — a commit hiccup keeps the lead, just without a brain path).
  let brainPath: string | null = null;
  if (paUser.brain_repo && paUser.github_token) {
    const date = new Date().toISOString().slice(0, 10);
    const path = `brain/leads/google-maps/${date}-${slug(config.location)}/${slug(business.name || domain || "business")}.md`;
    const commit = await commitBrainTextFile({
      repo: paUser.brain_repo,
      token: paUser.github_token,
      path,
      content: buildBrainNote({ sourceName: source.name, config, business, classification }),
      commitMessage: `Pocket Agent — Lead Scout (Maps): ${business.name || config.category}`,
    });
    if (commit.ok) brainPath = path;
  }

  await insertLead({
    runId,
    sourceId: source.id,
    ownerId,
    url,
    domain,
    name: business.name,
    contact: business.phone || business.email,
    summary: [business.category, business.address].filter(Boolean).join(" · "),
    profile: {
      category: business.category,
      address: business.address,
      phone: business.phone,
      email: business.email,
      website: business.website,
      has_website: Boolean(business.website),
      rating: business.rating,
      reviews_count: business.reviewsCount,
      maps_url: business.mapsUrl,
    },
    classification,
    brainPath,
    status: "extracted",
    error: null,
  });

  return { business, classification, url, domain };
}

// Fixed-size worker pool over the filtered businesses (order-preserving results).
async function runPool(
  items: MapsBusiness[],
  worker: (b: MapsBusiness) => Promise<SweepOutcome>,
): Promise<SweepOutcome[]> {
  const results: SweepOutcome[] = new Array(items.length);
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

// Page the SERP until we have `cap` businesses that pass the filters, a page comes back empty, or we
// hit the page ceiling. Returns the kept businesses + how many were seen (for the "X without a site"
// headline) + whether more were available past the cap.
async function collectBusinesses(params: {
  apiKey: string;
  config: MapsSweepConfig;
  cap: number;
}): Promise<{ kept: MapsBusiness[]; seen: number; capped: boolean; fetchError: string | null }> {
  const query = queryFor(params.config);
  const seenKeys = new Set<string>();
  const kept: MapsBusiness[] = [];
  let seen = 0;
  let capped = false;
  let fetchError: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchMapsViaSerp({ apiKey: params.apiKey, query, page });
    if (!res.ok) {
      // First-page failure is fatal (nothing collected); a later-page failure just ends paging with
      // whatever we already have. Either way it's recorded, never swallowed.
      if (page === 0) fetchError = res.error;
      break;
    }
    if (res.businesses.length === 0) break; // ran dry

    for (const b of res.businesses) {
      const key = businessKey(b);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      seen += 1;
      if (!passesFilters(b, params.config)) continue;
      if (kept.length >= params.cap) {
        capped = true;
        continue;
      }
      kept.push(b);
    }
    if (kept.length >= params.cap) break;
  }

  return { kept, seen, capped, fetchError };
}

/**
 * Pack framing for the batch card (Phase 4). When a source was subscribed from a vertical pack, the
 * card leads with the pack name + a reader-friendly noun ("roofers") instead of the raw category,
 * and points at the outreach step, so the card reads pack-specific.
 */
export type PackFraming = {
  packSlug: string;
  packName: string;
  /** Reader-friendly plural — "roofers", "med spas". */
  noun: string;
};

function buildCardBody(params: {
  config: MapsSweepConfig;
  breakdown: LeadBreakdown;
  outcomes: SweepOutcome[];
  noWebsiteCount: number;
  framing?: PackFraming;
}): string {
  const b = params.breakdown;
  const headline = params.config.filters.noWebsite
    ? `${params.noWebsiteCount} of these have no website on their Maps listing — exactly the ones to pitch.`
    : `${params.outcomes.length} businesses swept from Google Maps.`;
  const breakdownLine = `${b.hot} hot · ${b.warm} warm · ${b.cold} cold · ${b.wrong_fit} wrong-fit · ${b.needs_research} needs research`;
  const block = topLeadsBlock(
    params.outcomes.map((o) => ({
      name: o.business.name,
      domain: o.domain,
      summary: [o.business.category, o.business.address].filter(Boolean).join(" · "),
      url: o.url,
      classification: o.classification,
    })),
  );
  const lines = [headline, "", breakdownLine, "", block];
  if (params.framing) {
    lines.push(
      "",
      `Your first sweep from the **${params.framing.packName}** pack. Tap Generate outreach and PA writes a first email to each hot and warm lead in your voice, tuned for ${params.framing.noun}.`,
    );
  }
  return lines.join("\n");
}

// Card title — "47 roofers in Knoxville without websites" when the no-website filter is on. A pack
// source uses the pack's reader-friendly noun; a hand-built source falls back to the raw category.
function cardTitle(
  config: MapsSweepConfig,
  leadCount: number,
  noWebsiteCount: number,
  framing?: PackFraming,
): string {
  const noun = framing?.noun || config.category.trim() || "businesses";
  if (config.filters.noWebsite) {
    return `${noWebsiteCount} ${noun} in ${config.location} without websites`;
  }
  return `${leadCount} ${noun} in ${config.location}`;
}

export type SweepResult =
  | { ok: true; run: LeadScoutRun }
  | { ok: false; status: number; error: string };

/**
 * Run a full Google Maps sweep. Resolves the cap from the tier, pages the SERP, filters, classifies,
 * writes brain notes + lead rows, finishes the run, and stages the Google-Maps-framed batch card.
 */
export async function runMapsSweep(params: {
  source: LeadScoutSource;
  config: MapsSweepConfig;
  ownerId: string;
  paUser: PaUserLite;
  brightDataKey: string;
  tier: string;
  /** Set when the run is a pack subscription's first sweep — frames the card pack-specific (Phase 4). */
  framing?: PackFraming;
}): Promise<SweepResult> {
  const cap = mapsSweepCap(params.tier);

  const collected = await collectBusinesses({
    apiKey: params.brightDataKey,
    config: params.config,
    cap,
  });
  if (collected.fetchError && collected.kept.length === 0) {
    return { ok: false, status: 502, error: collected.fetchError };
  }

  const warnings: ConfigWarning[] = [];
  if (collected.capped) {
    warnings.push({
      url: queryFor(params.config),
      reason: `More than ${cap} matches found — stopped at your plan's ${cap}-lead cap for this run.`,
    });
  }

  const created = await createRun({
    sourceId: params.source.id,
    ownerId: params.ownerId,
    urlCount: collected.kept.length,
    configWarnings: warnings,
  });
  if (!created.ok) return { ok: false, status: created.status, error: created.error };
  const run = created.data;

  const outcomes = await runPool(collected.kept, (business) =>
    processBusiness({
      business,
      source: params.source,
      config: params.config,
      runId: run.id,
      ownerId: params.ownerId,
      paUser: params.paUser,
    }),
  );

  const breakdown = emptyBreakdown();
  for (const o of outcomes) breakdown[o.classification] += 1;
  const leadCount = outcomes.length;
  const noWebsiteCount = outcomes.filter((o) => !o.business.website).length;

  const finished = await finishRun({ runId: run.id, status: "completed", leadCount, breakdown });
  if (!finished.ok) return { ok: false, status: finished.status, error: finished.error };

  // Stage the Google-Maps-framed Mission Control card. Best-effort — a staging failure doesn't undo
  // the run, which is already saved.
  await createInboxItem({
    userId: params.ownerId,
    kind: "lead_scout_batch",
    title: cardTitle(params.config, leadCount, noWebsiteCount, params.framing),
    bodyMd: buildCardBody({
      config: params.config,
      breakdown,
      outcomes,
      noWebsiteCount,
      framing: params.framing,
    }),
    source: "lead-scout",
    payload: {
      runId: run.id,
      sourceId: params.source.id,
      sourceName: params.source.name,
      projectId: params.source.project_id,
      leadCount,
      breakdown,
      sweepKind: "google_maps",
      category: params.config.category,
      location: params.config.location,
      noWebsiteCount,
      ...(params.framing
        ? { packSlug: params.framing.packSlug, packName: params.framing.packName }
        : {}),
      csvPath: `/api/app/apps/lead-scout/runs/${run.id}/csv`,
      runPath: `/api/app/apps/lead-scout/runs/${run.id}`,
    },
  });

  return { ok: true, run: { ...run, status: "completed", lead_count: leadCount, breakdown } };
}
