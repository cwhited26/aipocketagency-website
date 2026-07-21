// enrichers/types.ts — the contract every enrichment adapter implements (SPEC §3, §4.1).
//
// An adapter is conditional on the owner having the connector configured (an env key today; a
// per-owner pa_connections row when those connectors land). It never scrapes LinkedIn — it queries a
// paid API and maps the result onto EnrichmentCandidate. It never throws: a missing key returns
// {configured:false}; an API error returns {ok:false} with a reason. The dispatcher (index.ts) runs
// every configured adapter and dedups by profile URL.

import type { EnrichmentCandidate, EnrichmentSource, SearchParams } from "../types";

/** The outcome of one adapter run. `configured:false` means the owner hasn't connected this source —
 *  it's not an error, just "skip me". `ok:false` is a real API/network failure surfaced honestly. */
export type EnricherResult =
  | { configured: false }
  | { configured: true; ok: true; candidates: EnrichmentCandidate[] }
  | { configured: true; ok: false; error: string };

/** An enrichment adapter: given the search + a per-request cap, return candidates (or a skip/error). */
export type Enricher = {
  source: EnrichmentSource;
  /** Read the adapter's env/config — true when the owner can run it. */
  isConfigured(): boolean;
  search(params: SearchParams, limit: number): Promise<EnricherResult>;
};

/** Shared HTTP timeout for an enrichment call — a slow connector shouldn't wedge the search route. */
export const ENRICHER_TIMEOUT_MS = 15_000;

/** Fetch with an abort timeout; adapters use this so one slow API can't hang the whole search. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = ENRICHER_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}
