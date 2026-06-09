// suggest.ts — "Suggested shows" for the podcast watch surface. Three brain-derived signals, no LLM
// cost (Phase 3, PA-PC-11):
//   - rivals tracked in (brain/)competitive/*  → suggest their show, cadence Realtime ("competitive intel")
//   - creators in voice/influences/*           → suggest their show, cadence Daily ("you learn from them")
//   - a show the owner has ingested 3+ times    → suggest following it, cadence by its dominant bucket
//                                                  (the self-feedback signal, same shape as YouTube's)
// Each name is resolved to a real feed via the free iTunes Search API (itunes-search.ts) — that's the
// only network the suggester does, and it costs nothing. Already-watched shows are filtered out.

import { readBrainSignals, type BrainSignalKind } from "./brain-signals";
import { searchPodcast, type ResolvedShow } from "./itunes-search";
import { fetchRecentPodcastIngests } from "./recent";
import { watchedShowIds, type WatchCadence } from "./watch";
import { USE_CASE_BUCKETS, type UseCaseBucket } from "./classify";

export type ShowSuggestion = {
  showId: string;
  title: string;
  host: string;
  feedUrl: string;
  artworkUrl: string;
  appleUrl: string;
  reason: string;
  cadence: WatchCadence;
};

const SUGGEST_COUNT_THRESHOLD = 3;
const MAX_SUGGESTIONS = 6;

/** A brain signal (creator/competitor) maps to a default cadence: rivals Realtime, creators Daily. */
export function cadenceForSignal(kind: BrainSignalKind): WatchCadence {
  return kind === "competitor" ? "realtime" : "daily";
}

type ShowTally = { showId: string; title: string; count: number; buckets: Record<UseCaseBucket, number> };

function emptyBuckets(): Record<UseCaseBucket, number> {
  return USE_CASE_BUCKETS.reduce(
    (acc, b) => ({ ...acc, [b]: 0 }),
    {} as Record<UseCaseBucket, number>,
  );
}

/** The bucket a show's ingests most often fell into — drives the history-suggestion cadence. */
export function dominantBucket(buckets: Record<UseCaseBucket, number>): UseCaseBucket {
  let best: UseCaseBucket = "default";
  let bestN = -1;
  for (const b of USE_CASE_BUCKETS) {
    if (buckets[b] > bestN) {
      best = b;
      bestN = buckets[b];
    }
  }
  return best;
}

/** Cadence for a 3+-ingested show, by its dominant bucket: competitor → Realtime, tactic → Daily, else Weekly. */
export function cadenceForBucket(bucket: UseCaseBucket): WatchCadence {
  if (bucket === "competitor") return "realtime";
  if (bucket === "tactic") return "daily";
  return "weekly";
}

/**
 * Suggests shows to follow, derived from the owner's brain (rivals + creators) and their ingest history
 * (3+-seen shows), minus shows they already watch. Resolves each to a real feed via iTunes Search.
 */
export async function suggestShows(ownerId: string, repo: string, token: string | null): Promise<ShowSuggestion[]> {
  const [signals, ingests, watched] = await Promise.all([
    readBrainSignals(repo, token),
    fetchRecentPodcastIngests(ownerId, { limit: 200 }),
    watchedShowIds(ownerId),
  ]);

  // 1) Brain-signal candidates: resolve each name to a show via iTunes (in parallel — all free).
  const signalResolved = await Promise.all(
    signals.map(async (sig) => {
      const show = await searchPodcast(sig.name);
      if (!show) return null;
      const reason =
        sig.kind === "competitor"
          ? `A rival you track — ${sig.name}'s show`
          : `A creator you learn from — ${sig.name}`;
      return { show, reason, cadence: cadenceForSignal(sig.kind) };
    }),
  );

  // 2) Ingest-history candidates: shows seen 3+ times, resolved by title to get a concrete feed.
  const tallies = new Map<string, ShowTally>();
  for (const ing of ingests) {
    if (!ing.showId) continue;
    let t = tallies.get(ing.showId);
    if (!t) {
      t = { showId: ing.showId, title: ing.showTitle, count: 0, buckets: emptyBuckets() };
      tallies.set(ing.showId, t);
    }
    t.count++;
    t.buckets[ing.bucket]++;
  }
  const historyResolved = await Promise.all(
    [...tallies.values()]
      .filter((t) => t.count >= SUGGEST_COUNT_THRESHOLD && !watched.has(t.showId))
      .map(async (t) => {
        const show = await searchPodcast(t.title);
        if (!show) return null;
        return {
          show,
          reason: `PA has listened to ${t.count} episodes of this show`,
          cadence: cadenceForBucket(dominantBucket(t.buckets)),
        };
      }),
  );

  // 3) Merge, filter already-watched + duplicates, cap. Competitor (realtime) signals lead.
  const ordered = [...signalResolved, ...historyResolved].filter(
    (c): c is { show: ResolvedShow; reason: string; cadence: WatchCadence } => c !== null,
  );
  const seen = new Set<string>();
  const suggestions: ShowSuggestion[] = [];
  for (const c of ordered) {
    if (watched.has(c.show.showId) || seen.has(c.show.showId)) continue;
    seen.add(c.show.showId);
    suggestions.push({
      showId: c.show.showId,
      title: c.show.title,
      host: c.show.host,
      feedUrl: c.show.feedUrl,
      artworkUrl: c.show.artworkUrl,
      appleUrl: c.show.appleUrl,
      reason: c.reason,
      cadence: c.cadence,
    });
    if (suggestions.length >= MAX_SUGGESTIONS) break;
  }
  return suggestions;
}
