// card.ts — the contract for the inline "podcast_ingest" card the Ask box renders when a podcast link
// arrives in chat. It rides in pocket_agent_messages.metadata (the same jsonb migration 034 added for
// upload_result / youtube_ingest; a message carries exactly one card kind). The agent reads the
// transcript + summary from the message `content`; this payload only drives the rich render — artwork,
// episode title, show/host, the bucket-specific framing, and a "View transcript" expander.
//
// One Zod source of truth so a drifted metadata blob fails validation and degrades to a plain bubble
// instead of crashing the thread. Types are z.infer'd — zero `any`.

import { z } from "zod";

export const PODCAST_INGEST_KIND = "podcast_ingest" as const;

/** The use-case bucket the classifier assigned — drives the card's lead framing + brain routing. */
export const PODCAST_BUCKETS = ["competitor", "tactic", "testimonial", "industry", "default"] as const;

/** How the episode was processed — Phase 1 is always full_transcript; notes_only is the cheap path. */
export const PODCAST_MODES = ["full_transcript", "notes_only"] as const;

export const PodcastIngestEpisodeSchema = z.object({
  episodeId: z.string().min(1).max(500),
  title: z.string().max(500),
  show: z.string().max(300),
  host: z.string().max(300).default(""),
  /** Use-case bucket (competitor / tactic / testimonial / industry / default). */
  bucket: z.enum(PODCAST_BUCKETS),
  /** The bucket-specific lead line, e.g. "Logged what they claimed — added to your competitive intel." */
  framingHeadline: z.string().max(300),
  /** Short label for the detail block, e.g. "What they claimed" / "Techniques" / "Lift-and-paste quotes". */
  detailLabel: z.string().max(80),
  /** The bucket-specific extraction (claims paragraph / techniques bullets / quotes / rundown / summary). */
  bucketDetail: z.string().max(6000),
  /** Show artwork URL (from iTunes lookup or the feed); may be empty. */
  artworkUrl: z.string().max(1000).default(""),
  /** The link the owner shared, shown as the "Open" link. */
  url: z.string().max(1000),
  /** One-paragraph summary the calling surface can show inline. */
  summary: z.string().max(4000),
  /** Repo-relative path of the brain note (brain/podcasts/<show>/<date>-<slug>.md). */
  brainPath: z.string().max(500),
  /** full_transcript | notes_only. */
  mode: z.enum(PODCAST_MODES),
  /** Character count of the transcript (or notes) written to the brain. */
  transcriptChars: z.number().int().min(0),
  /** Episode length in seconds (0 when the feed omits it). */
  durationSeconds: z.number().int().min(0).default(0),
  /** Bounded transcript excerpt for the "View transcript" expander (full text lives in the brain). */
  transcriptPreview: z.string().max(8000),
  /** True when transcriptPreview is shorter than the full transcript. */
  truncated: z.boolean(),
});
export type PodcastIngestEpisode = z.infer<typeof PodcastIngestEpisodeSchema>;

export const PodcastIngestPayloadSchema = z.object({
  kind: z.literal(PODCAST_INGEST_KIND),
  /** The text the owner sent alongside the link (may be empty). */
  caption: z.string().max(10_000),
  episodes: z.array(PodcastIngestEpisodeSchema).min(1).max(4),
});
export type PodcastIngestPayload = z.infer<typeof PodcastIngestPayloadSchema>;

/** Safe-parses message.metadata into a podcast-ingest payload, or null if it isn't one. */
export function asPodcastIngestPayload(metadata: unknown): PodcastIngestPayload | null {
  const parsed = PodcastIngestPayloadSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}
