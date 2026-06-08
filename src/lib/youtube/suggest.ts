// suggest.ts — "Suggested channels" for the watch UI. Derives obvious watch candidates from the
// owner's bucket-classified ingest history (pa_youtube_ingests) — which IS the brain signal: every
// competitor video already landed in brain/competitive, every creator clip in brain/voice/influences.
// Reading the index table instead of re-parsing markdown is reliable and zero-`any`.
//
// Rules (PA-YT-14):
//   - a channel whose videos landed as competitor → Daily ("competitive intel")
//   - a channel whose videos landed as tactic (creator) → Daily ("you're learning from them")
//   - any channel appearing 3+ times in ingests → suggest (cadence by its dominant bucket)
//   - a channel whose videos landed as industry → Weekly ("industry channel in your field")
// Already-watched channels are filtered out. Returns the strongest 6.

import { fetchRecentYouTubeIngests } from "@/lib/youtube/recent";
import { watchedChannelIds, type WatchCadence } from "@/lib/youtube/watch";
import type { UseCaseBucket } from "@/lib/youtube/classify";

export type ChannelSuggestion = {
  channelId: string;
  displayName: string;
  reason: string;
  cadence: WatchCadence;
  /** How many of the owner's ingests came from this channel — drives the ranking. */
  videoCount: number;
};

const SUGGEST_COUNT_THRESHOLD = 3;
const MAX_SUGGESTIONS = 6;

type Group = {
  channelId: string;
  displayName: string;
  count: number;
  buckets: Record<UseCaseBucket, number>;
};

function dominantBucket(buckets: Record<UseCaseBucket, number>): UseCaseBucket {
  let best: UseCaseBucket = "default";
  let bestN = -1;
  for (const [bucket, n] of Object.entries(buckets) as Array<[UseCaseBucket, number]>) {
    if (n > bestN) {
      best = bucket;
      bestN = n;
    }
  }
  return best;
}

/** Builds the (reason, cadence) for a group, or null when it isn't a strong-enough candidate. */
function candidateFor(group: Group): { reason: string; cadence: WatchCadence } | null {
  const b = group.buckets;
  if (b.competitor > 0) return { reason: "You've logged competitive intel from this channel", cadence: "daily" };
  if (b.tactic > 0) return { reason: "A creator you've been learning from", cadence: "daily" };
  if (group.count >= SUGGEST_COUNT_THRESHOLD) {
    return { reason: `You've shared ${group.count} videos from this channel`, cadence: dominantBucket(b) === "industry" ? "weekly" : "daily" };
  }
  if (b.industry > 0) return { reason: "An industry channel in your field", cadence: "weekly" };
  return null;
}

/** Suggests channels to watch, derived from the owner's ingest history, minus those already watched. */
export async function suggestChannels(ownerId: string): Promise<ChannelSuggestion[]> {
  const [ingests, watched] = await Promise.all([
    fetchRecentYouTubeIngests(ownerId, { limit: 200 }),
    watchedChannelIds(ownerId),
  ]);

  const groups = new Map<string, Group>();
  for (const ing of ingests) {
    if (!ing.channelId || watched.has(ing.channelId)) continue;
    let g = groups.get(ing.channelId);
    if (!g) {
      g = {
        channelId: ing.channelId,
        displayName: ing.channel,
        count: 0,
        buckets: { competitor: 0, tactic: 0, testimonial: 0, industry: 0, default: 0 },
      };
      groups.set(ing.channelId, g);
    }
    g.count++;
    g.buckets[ing.bucket]++;
  }

  const suggestions: ChannelSuggestion[] = [];
  for (const g of groups.values()) {
    const cand = candidateFor(g);
    if (!cand) continue;
    suggestions.push({
      channelId: g.channelId,
      displayName: g.displayName,
      reason: cand.reason,
      cadence: cand.cadence,
      videoCount: g.count,
    });
  }

  suggestions.sort((a, b) => b.videoCount - a.videoCount);
  return suggestions.slice(0, MAX_SUGGESTIONS);
}
