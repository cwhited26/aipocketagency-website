// search.ts — the enrichment dispatcher (SPEC §4.1, §12.2).
//
// Reads the owner's configured enrichment adapters, runs the search across each in parallel, dedups by
// LinkedIn profile URL (first source to surface a URL wins), fit-scores each survivor against the ICP,
// and returns the ranked candidate list. Pure orchestration over the adapters + the pure fit-scorer —
// no DB writes here (the route persists the run + shortlisted prospects). Never throws: an adapter
// that errors is folded into `sourceErrors` and the rest still return, so one bad connector can't sink
// the search.

import { enrichersFor } from "./enrichers";
import { icpFromSearch, scoreFit } from "./fitscore";
import type { EnrichmentCandidate, EnrichmentSource, SearchParams } from "./types";

/** A scored candidate — an enrichment candidate plus its 0-100 ICP fit. */
export type ScoredCandidate = EnrichmentCandidate & { fitScore: number };

export type SearchOutcome = {
  /** Ranked, deduped, fit-scored candidates (highest fit first). */
  candidates: ScoredCandidate[];
  /** Which configured sources actually ran. */
  sourcesRun: EnrichmentSource[];
  /** Per-source errors (a connector that failed) — surfaced so the UI can flag a degraded search. */
  sourceErrors: { source: EnrichmentSource; error: string }[];
  /** True when the owner has NO configured enrichment source at all → show the connect empty state. */
  noSourcesConfigured: boolean;
};

/** Normalize a LinkedIn URL for dedup: lowercase host+path, strip a trailing slash + query/hash, so
 *  two adapters returning the same person under cosmetically different URLs collapse to one. */
export function normalizeProfileUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.host.toLowerCase()}${path.toLowerCase()}`;
  } catch {
    // Not a full URL (some adapters return a bare "linkedin.com/in/x") — normalize by hand.
    return trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase().split(/[?#]/)[0];
  }
}

/**
 * Run the search across every configured enrichment source, dedup, fit-score, and rank.
 * @param params  the ICP the owner submitted
 * @param limit   per-source candidate ceiling (the route clamps the owner's slider)
 */
export async function runEnrichmentSearch(
  params: SearchParams,
  limit = 25,
): Promise<SearchOutcome> {
  const adapters = enrichersFor(params.sources);
  if (adapters.length === 0) {
    return { candidates: [], sourcesRun: [], sourceErrors: [], noSourcesConfigured: true };
  }

  const results = await Promise.all(
    adapters.map(async (a) => ({ source: a.source, result: await a.search(params, limit) })),
  );

  const icp = icpFromSearch(params);
  const byUrl = new Map<string, ScoredCandidate>();
  const sourcesRun: EnrichmentSource[] = [];
  const sourceErrors: { source: EnrichmentSource; error: string }[] = [];

  for (const { source, result } of results) {
    if (!result.configured) continue;
    sourcesRun.push(source);
    if (!result.ok) {
      sourceErrors.push({ source, error: result.error });
      continue;
    }
    for (const cand of result.candidates) {
      const key = normalizeProfileUrl(cand.linkedinProfileUrl);
      if (!key || byUrl.has(key)) continue; // first source to surface a URL wins
      byUrl.set(key, { ...cand, fitScore: scoreFit(cand.signals, icp) });
    }
  }

  const candidates = [...byUrl.values()].sort((a, b) => b.fitScore - a.fitScore);
  return { candidates, sourcesRun, sourceErrors, noSourcesConfigured: false };
}
