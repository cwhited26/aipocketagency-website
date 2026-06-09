// classify.ts — sort a podcast episode into the same 4 use-case buckets as YouTube, reusing the
// YouTube classifier verbatim (PA-PC-3): a tactic is a tactic whether it was said on video or audio,
// so there's one classifier and one place to improve it.
//
// The only podcast-specific delta is brain-folder routing: the YouTube industry/default notes land in
// brain/youtube; podcast industry/default notes land in brain/podcasts. competitor / tactic /
// testimonial route to the same shared brain areas as YouTube so a competitor claim sits next to the
// competitor claims from video, regardless of where it was said.

import type { CostContext } from "@/lib/cost/log";
import {
  classifyBucket,
  extractBucketDetail,
  BUCKET_FRAMINGS,
  USE_CASE_BUCKETS,
  type UseCaseBucket,
} from "@/lib/youtube/classify";

export { classifyBucket, extractBucketDetail, USE_CASE_BUCKETS };
export type { UseCaseBucket };

/** Per-bucket framing for podcasts: the YouTube headlines/labels, but industry/default → brain/podcasts. */
export const PODCAST_BUCKET_FRAMINGS: Record<
  UseCaseBucket,
  { headline: string; brainDir: string; detailLabel: string }
> = {
  competitor: BUCKET_FRAMINGS.competitor,
  tactic: BUCKET_FRAMINGS.tactic,
  testimonial: BUCKET_FRAMINGS.testimonial,
  industry: { ...BUCKET_FRAMINGS.industry, brainDir: "brain/podcasts" },
  default: { ...BUCKET_FRAMINGS.default, brainDir: "brain/podcasts" },
};

/**
 * Classifies an episode by its transcript (or show notes, for notes-only), framing the classifier call
 * with the show + host so the bucket pick has podcast context. Delegates to the YouTube Haiku
 * classifier — degrades to "default" on no-key / API error (never throws).
 */
export async function classifyEpisode(params: {
  apiKey: string | null;
  episodeTitle: string;
  show: string;
  host: string;
  transcriptHead: string;
  /** When set, one anthropic (Haiku) cost event is logged for this classify call. */
  cost?: CostContext;
}): Promise<UseCaseBucket> {
  // The YouTube classifier takes (title, channel) — pass the show + host as the "channel" so a podcast
  // gets the same author signal a YouTube channel does.
  const channel = params.host ? `${params.show} — ${params.host}` : params.show;
  return classifyBucket({
    apiKey: params.apiKey,
    title: params.episodeTitle,
    channel,
    transcriptHead: params.transcriptHead,
    cost: params.cost,
  });
}
