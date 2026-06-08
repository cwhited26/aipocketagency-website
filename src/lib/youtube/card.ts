// card.ts — the contract for the inline "youtube_ingest" card the Ask box renders when a YouTube
// link arrives in chat. It rides in pocket_agent_messages.metadata (migration 034, the same jsonb
// the upload_result and slack_origin payloads use; a message carries exactly one of them). The agent
// reads the transcript + summary from the message `content`; this payload only drives the rich render
// — thumbnail, title, channel, the one-paragraph summary, and a "View transcript" expander.
//
// One Zod source of truth so a drifted metadata blob fails validation and degrades to a plain bubble
// instead of crashing the thread. Types are z.infer'd — zero `any`.

import { z } from "zod";

export const YOUTUBE_INGEST_KIND = "youtube_ingest" as const;

/** The use-case bucket the classifier assigned — drives the card's lead framing + brain routing. */
export const YOUTUBE_BUCKETS = ["competitor", "tactic", "testimonial", "industry", "default"] as const;

export const YouTubeIngestVideoSchema = z.object({
  videoId: z.string().min(1).max(20),
  title: z.string().max(500),
  channel: z.string().max(300),
  /** Use-case bucket (competitor / tactic / testimonial / industry / default). */
  bucket: z.enum(YOUTUBE_BUCKETS),
  /** The bucket-specific lead line, e.g. "Logged what they claimed — added to your competitive intel." */
  framingHeadline: z.string().max(300),
  /** Short label for the detail block, e.g. "What they claimed" / "Techniques" / "Lift-and-paste quotes". */
  detailLabel: z.string().max(80),
  /** The bucket-specific extraction (claims paragraph / techniques bullets / quotes / rundown / summary). */
  bucketDetail: z.string().max(6000),
  /** Thumbnail URL (Data API best thumb, or the default i.ytimg.com hqdefault). */
  thumbnailUrl: z.string().max(1000),
  /** Canonical watch URL, shown as the "Watch on YouTube" link. */
  url: z.string().max(500),
  /** One-paragraph summary the calling surface can show inline. */
  summary: z.string().max(4000),
  /** Repo-relative path of the brain note (brain/youtube/<channel>/<date>-<slug>.md). */
  brainPath: z.string().max(500),
  /** Character count of the full transcript written to the brain. */
  transcriptChars: z.number().int().min(0),
  /** True when the transcript came from Whisper (no captions) rather than timedtext. */
  usedWhisper: z.boolean(),
  /** Bounded transcript excerpt for the "View transcript" expander (full text lives in the brain). */
  transcriptPreview: z.string().max(8000),
  /** True when transcriptPreview is shorter than the full transcript. */
  truncated: z.boolean(),
});
export type YouTubeIngestVideo = z.infer<typeof YouTubeIngestVideoSchema>;

export const YouTubeIngestPayloadSchema = z.object({
  kind: z.literal(YOUTUBE_INGEST_KIND),
  /** The text the owner sent alongside the link (may be empty). */
  caption: z.string().max(10_000),
  videos: z.array(YouTubeIngestVideoSchema).min(1).max(4),
});
export type YouTubeIngestPayload = z.infer<typeof YouTubeIngestPayloadSchema>;

/** Safe-parses message.metadata into a youtube-ingest payload, or null if it isn't one. */
export function asYouTubeIngestPayload(metadata: unknown): YouTubeIngestPayload | null {
  const parsed = YouTubeIngestPayloadSchema.safeParse(metadata);
  return parsed.success ? parsed.data : null;
}
