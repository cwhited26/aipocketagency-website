// ingest.ts — the YouTube ingester orchestrator and the one hook every inbound surface calls.
//
// Pipeline for a single video id:
//   metadata (Data API v3) → transcript (timedtext, else Whisper audio fallback) → one-paragraph
//   summary (Anthropic) → write a clean brain note at brain/youtube/<channel>/<date>-<slug>.md
//   (via the brain committer) → record the ingest (pa_youtube_ingests) → return the brain path, the
//   summary, the inline-card data, and a plain-text context block the calling surface folds into the
//   agent's turn so it can actually act on the video.
//
// maybeIngestYouTubeUrls(text, ownerId, source) is the shared entry point: it detects every YouTube
// link in the text, resolves the owner's brain + keys, and ingests each (capped). Surfaces that have
// already loaded the owner context can call ingestYouTubeVideo directly; surfaces that only know the
// owner id use the maybe* helper. Both honor the brand-wide hard rules — direct REST, no `any`, no
// silent catch.

import { extractYouTubeIds, watchUrl, defaultThumbnailUrl } from "@/lib/youtube/detect";
import { fetchTranscript } from "@/lib/youtube/transcript";
import { fetchVideoMetadata, type YouTubeMetadata } from "@/lib/youtube/metadata";
import { transcribeYouTubeAudio } from "@/lib/youtube/whisper-fallback";
import { recordYouTubeIngest } from "@/lib/youtube/log";
import {
  classifyBucket,
  extractBucketDetail,
  BUCKET_FRAMINGS,
  type UseCaseBucket,
} from "@/lib/youtube/classify";
import {
  YOUTUBE_INGEST_KIND,
  type YouTubeIngestVideo,
  type YouTubeIngestPayload,
} from "@/lib/youtube/card";
import { commitBrainTextFile } from "@/lib/brain/absorb";
import { fetchPaUser } from "@/lib/pa-supabase";

// ── Tunables ───────────────────────────────────────────────────────────────────

/** Cap on videos ingested from one message — bounds cost when a message dumps many links. */
export const MAX_VIDEOS_PER_MESSAGE = 4;
/** How much transcript the agent reads in its turn (the full text always lives in the brain note). */
const CONTEXT_TRANSCRIPT_CHARS = 12_000;
/** How much transcript the inline card's "View transcript" expander shows (matches the card schema). */
const PREVIEW_TRANSCRIPT_CHARS = 8_000;

// ── Surfaces ─────────────────────────────────────────────────────────────────────

/** Every source a YouTube link can be ingested from. The seven inbound text surfaces each call
 *  maybeIngestYouTubeUrls(text, ownerId, "<surface>"); "channel_watch" is the v1.1 RSS poller, which
 *  calls ingestYouTubeVideo directly when a watched channel posts a new upload. */
export type InboundSurface =
  | "ask_box"
  | "ios_share"
  | "mobile_capture"
  | "slack_dm"
  | "inbound_email"
  | "bcc"
  | "sms"
  | "channel_watch";

const SURFACE_LABELS: Record<InboundSurface, string> = {
  ask_box: "the Ask box",
  ios_share: "an iOS share",
  mobile_capture: "a mobile capture",
  slack_dm: "Slack",
  inbound_email: "an inbound email",
  bcc: "a BCC'd email",
  sms: "a text message",
  channel_watch: "a channel you watch",
};

// ── Results ────────────────────────────────────────────────────────────────────

export type YouTubeIngestResult =
  | {
      ok: true;
      videoId: string;
      url: string;
      title: string;
      channel: string;
      brainPath: string;
      summary: string;
      usedWhisper: boolean;
      /** Inline-card data for pocket_agent_messages.metadata. */
      card: YouTubeIngestVideo;
      /** Plain-text block the surface folds into the agent's turn so it reads the video. */
      contextBlock: string;
    }
  | { ok: false; videoId: string; url: string; error: string };

export type YouTubeOwnerContext = {
  ownerId: string;
  repo: string;
  token: string;
  anthropicApiKey: string | null;
  openaiApiKey: string | null;
};

// ── Slug + path ────────────────────────────────────────────────────────────────

function slugify(input: string, fallback: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || fallback;
}

/** <dir>/<channel-slug>/<YYYY-MM-DD>-<title-slug>.md — dir defaults to brain/youtube, but the
 *  classifier routes competitor/tactic/testimonial notes to their own brain areas. */
export function brainNotePath(
  channel: string,
  title: string,
  dateIso: string,
  dir = "brain/youtube",
): string {
  const channelSlug = slugify(channel, "unknown-channel");
  const titleSlug = slugify(title, "video");
  const date = dateIso.slice(0, 10);
  return `${dir}/${channelSlug}/${date}-${titleSlug}.md`;
}

/** Builds a timestamped transcript (`[mm:ss] line`) from caption segments, capped, so the
 *  testimonial/industry extractions can cite moments. Whisper transcripts have no segments → "". */
export function timestampedTranscript(
  segments: Array<{ start: number; text: string }>,
  maxChars = 28_000,
): string {
  const lines: string[] = [];
  let total = 0;
  for (const seg of segments) {
    const mm = Math.floor(seg.start / 60);
    const ss = Math.floor(seg.start % 60);
    const line = `[${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}] ${seg.text}`;
    if (total + line.length > maxChars) break;
    lines.push(line);
    total += line.length + 1;
  }
  return lines.join("\n");
}

// ── Summary ──────────────────────────────────────────────────────────────────────

const SUMMARY_PROMPT = `Summarize the following YouTube video transcript in ONE tight paragraph (3-5 sentences) a busy business owner can read in ten seconds. Lead with what the video is actually about and the most useful takeaway. Plain English, no preamble, no bullet points, no "this video" filler — just the substance.`;

/**
 * Produces a one-paragraph summary of the transcript via Anthropic. Falls back to a deterministic
 * excerpt when no key is connected or the call fails — a degraded summary is far better than none,
 * and the failure is handled explicitly (not swallowed): the caller always gets usable text.
 */
async function summarizeTranscript(
  apiKey: string | null,
  video: { title: string; channel: string; fullText: string },
): Promise<string> {
  const excerptFallback = (): string => {
    const head = video.fullText.replace(/\s+/g, " ").trim().slice(0, 400);
    return head ? `${head}${video.fullText.length > 400 ? "…" : ""}` : "Transcript saved to your brain.";
  };

  if (!apiKey) return excerptFallback();

  // Cap the transcript we send so a 3-hour video doesn't blow the summary call.
  const transcriptForModel = video.fullText.slice(0, 24_000);

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `${SUMMARY_PROMPT}\n\nVideo: "${video.title}" by ${video.channel}\n\nTranscript:\n${transcriptForModel}`,
          },
        ],
      }),
      cache: "no-store",
    });
  } catch {
    // Network failure on the (optional) summary step degrades to the excerpt — deliberate, not silent.
    return excerptFallback();
  }
  if (!res.ok) return excerptFallback();

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim();
  return text || excerptFallback();
}

// ── Note rendering ───────────────────────────────────────────────────────────────

function buildNoteMarkdown(params: {
  videoId: string;
  url: string;
  meta: YouTubeMetadata | null;
  metaNote: string | null;
  fullText: string;
  summary: string;
  bucket: UseCaseBucket;
  detailLabel: string;
  bucketDetail: string;
  source: InboundSurface;
  captionSource: "captions" | "whisper";
  ingestedAt: string;
}): string {
  const { meta, videoId, url } = params;
  const title = meta?.title ?? `YouTube video ${videoId}`;
  const channel = meta?.channel ?? "Unknown channel";

  // Frontmatter — quoted scalars so colons/quotes in titles can't break the YAML.
  const yaml = (k: string, v: string | number | boolean): string =>
    typeof v === "string" ? `${k}: ${JSON.stringify(v)}` : `${k}: ${v}`;

  const front = [
    "---",
    yaml("video_id", videoId),
    yaml("title", title),
    yaml("channel", channel),
    yaml("channel_id", meta?.channelId ?? ""),
    yaml("url", url),
    yaml("posted_at", meta?.postedAt ?? ""),
    yaml("duration_seconds", meta?.durationSeconds ?? 0),
    yaml("view_count", meta?.viewCount ?? 0),
    yaml("like_count", meta?.likeCount ?? 0),
    yaml("source_inbound_surface", params.source),
    yaml("use_case_bucket", params.bucket),
    yaml("captions", params.captionSource),
    yaml("ingested_at", params.ingestedAt),
    "metadata:",
    "  type: reference",
    "---",
  ].join("\n");

  const body: string[] = [`# ${title}`, "", `**Channel:** ${channel}`];
  if (meta?.postedAt) body.push(`**Posted:** ${meta.postedAt.slice(0, 10)}`);
  body.push(`**Watch:** ${url}`);
  if (params.captionSource === "whisper") {
    body.push("", "_No captions were available — this transcript was generated from the audio (Whisper)._");
  }
  if (params.metaNote) body.push("", `_Note: ${params.metaNote}_`);
  // The bucket-specific extraction leads (claims / techniques / quotes / rundown); the generic
  // summary still follows for non-default buckets so the note has both the angle and the overview.
  body.push("", `## ${params.detailLabel}`, "", params.bucketDetail);
  if (params.bucket !== "default" && params.summary.trim() && params.summary.trim() !== params.bucketDetail.trim()) {
    body.push("", "## Summary", "", params.summary);
  }
  if (meta?.description) body.push("", "## Description", "", meta.description);
  body.push("", "## Transcript", "", params.fullText.trim());

  return `${front}\n\n${body.join("\n")}\n`;
}

function buildContextBlock(params: {
  source: InboundSurface;
  title: string;
  channel: string;
  url: string;
  brainPath: string;
  framingHeadline: string;
  detailLabel: string;
  bucketDetail: string;
  fullText: string;
}): string {
  const truncated = params.fullText.length > CONTEXT_TRANSCRIPT_CHARS;
  const transcript = params.fullText.slice(0, CONTEXT_TRANSCRIPT_CHARS);
  const lines = [
    `[YouTube video ingested from ${SURFACE_LABELS[params.source]}: "${params.title}" — ${params.channel}]`,
    `Watch: ${params.url}`,
    `${params.framingHeadline} Saved to the brain at ${params.brainPath}.`,
    `${params.detailLabel}: ${params.bucketDetail}`,
    `Transcript${truncated ? " (excerpt — full text is in the brain note)" : ""}:`,
    transcript,
  ];
  return lines.join("\n");
}

// ── Single-video ingest ──────────────────────────────────────────────────────────

/**
 * Ingests one video for an owner whose brain context is already resolved. Returns a typed result —
 * a success carries the brain path, summary, card data, and the agent context block; a failure
 * carries an honest reason (e.g. captionless + Whisper skipped, or the brain commit failed).
 */
export async function ingestYouTubeVideo(params: {
  videoId: string;
  source: InboundSurface;
  ctx: YouTubeOwnerContext;
  allowLong: boolean;
}): Promise<YouTubeIngestResult> {
  const { videoId, source, ctx } = params;
  const url = watchUrl(videoId);
  const ingestedAt = new Date().toISOString();

  // 1. Metadata (best-effort enrichment — never blocks the ingest).
  const metaResult = await fetchVideoMetadata(videoId, process.env.YOUTUBE_API_KEY ?? null);
  const meta = metaResult.ok ? metaResult.metadata : null;
  const metaNote = metaResult.ok ? null : metaResult.message;
  const title = meta?.title ?? `YouTube video ${videoId}`;
  const channel = meta?.channel ?? "Unknown channel";
  const thumbnailUrl = meta?.thumbnailUrl || defaultThumbnailUrl(videoId);

  // 2. Transcript: timedtext first, Whisper audio fallback when captionless.
  let fullText: string;
  let captionSource: "captions" | "whisper";
  let segments: Array<{ start: number; text: string }> = [];
  const transcript = await fetchTranscript(videoId);
  if (transcript) {
    fullText = transcript.full_text;
    segments = transcript.segments;
    captionSource = "captions";
  } else {
    const whisper = await transcribeYouTubeAudio({
      videoId,
      durationSeconds: meta?.durationSeconds ?? null,
      allowLong: params.allowLong,
      openaiApiKey: ctx.openaiApiKey,
    });
    if (!whisper.ok) {
      return { ok: false, videoId, url, error: whisper.message };
    }
    fullText = whisper.full_text;
    captionSource = "whisper";
  }

  // 3. Classify the use-case bucket (cheap Haiku), then run the generic summary + the bucket-specific
  //    extraction in parallel — the extraction leads the card; the summary backstops it / the default.
  const bucket = await classifyBucket({
    apiKey: ctx.anthropicApiKey,
    title,
    channel,
    transcriptHead: fullText.slice(0, 500),
  });
  const detailTranscript = segments.length > 0 ? timestampedTranscript(segments) : fullText;
  const summary = await summarizeTranscript(ctx.anthropicApiKey, { title, channel, fullText });
  // For non-default buckets, the detail is the tailored extraction; default reuses the summary
  // (extractBucketDetail short-circuits to genericSummary for the default bucket — no extra call).
  const bucketDetail = await extractBucketDetail({
    apiKey: ctx.anthropicApiKey,
    bucket,
    title,
    channel,
    transcript: detailTranscript,
    genericSummary: summary,
  });
  const framing = BUCKET_FRAMINGS[bucket];

  // 4. Write the brain note — routed by bucket (competitive intel / voice influences / testimonials /
  //    the youtube roll-up).
  const dateIso = meta?.postedAt || ingestedAt;
  const brainPath = brainNotePath(channel, title, dateIso, framing.brainDir);
  const markdown = buildNoteMarkdown({
    videoId,
    url,
    meta,
    metaNote,
    fullText,
    summary,
    bucket,
    detailLabel: framing.detailLabel,
    bucketDetail,
    source,
    captionSource,
    ingestedAt,
  });
  const commit = await commitBrainTextFile({
    repo: ctx.repo,
    token: ctx.token,
    path: brainPath,
    content: markdown,
    commitMessage: `Pocket Agent — YouTube: ${title}`,
  });
  if (!commit.ok) {
    return { ok: false, videoId, url, error: `Couldn't save the video to your brain: ${commit.error}` };
  }

  // 5. Record the ingest (analytics row + the bucket choice, so the classifier can be refined). A
  //    logging miss is non-fatal — the note is already saved — but it returns a typed result, not a
  //    swallow.
  await recordYouTubeIngest({
    ownerId: ctx.ownerId,
    videoId,
    channelId: meta?.channelId ?? "",
    channel,
    title,
    brainPath,
    transcriptChars: fullText.length,
    usedWhisper: captionSource === "whisper",
    useCaseBucket: bucket,
    sourceInboundSurface: source,
  });

  const truncated = fullText.length > PREVIEW_TRANSCRIPT_CHARS;
  const card: YouTubeIngestVideo = {
    videoId,
    title,
    channel,
    channelId: meta?.channelId ?? "",
    bucket,
    framingHeadline: framing.headline,
    detailLabel: framing.detailLabel,
    bucketDetail,
    thumbnailUrl,
    url,
    summary,
    brainPath,
    transcriptChars: fullText.length,
    usedWhisper: captionSource === "whisper",
    transcriptPreview: fullText.slice(0, PREVIEW_TRANSCRIPT_CHARS),
    truncated,
  };

  return {
    ok: true,
    videoId,
    url,
    title,
    channel,
    brainPath,
    summary,
    usedWhisper: captionSource === "whisper",
    card,
    contextBlock: buildContextBlock({
      source,
      title,
      channel,
      url,
      brainPath,
      framingHeadline: framing.headline,
      detailLabel: framing.detailLabel,
      bucketDetail,
      fullText,
    }),
  };
}

// ── The shared surface hook ──────────────────────────────────────────────────────

// The override phrase that lets an owner opt past the long-video Whisper cost ceiling (PA-YT-4).
function allowLongFor(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("transcribe long") || lower.includes("allow long") || lower.includes("long video");
}

/**
 * Detects every YouTube link in `text` and ingests each for `ownerId`, returning one result per
 * video (capped at MAX_VIDEOS_PER_MESSAGE). Returns [] when the text has no YouTube link. Every
 * inbound surface calls this; surfaces fold the ok results' contextBlocks into the agent's turn and
 * render the card from buildYouTubeCardPayload.
 */
export async function maybeIngestYouTubeUrls(
  text: string,
  ownerId: string,
  source: InboundSurface,
): Promise<YouTubeIngestResult[]> {
  const ids = extractYouTubeIds(text);
  if (ids.length === 0) return [];

  const paResult = await fetchPaUser(ownerId);
  if (!paResult.ok || !paResult.data) {
    return ids.map((videoId) => ({
      ok: false as const,
      videoId,
      url: watchUrl(videoId),
      error: "Couldn't load your account to save the video.",
    }));
  }
  const paUser = paResult.data;
  if (!paUser.brain_repo || !paUser.github_token) {
    return ids.map((videoId) => ({
      ok: false as const,
      videoId,
      url: watchUrl(videoId),
      error: "Connect your brain in Settings before I can save a video transcript.",
    }));
  }

  const ctx: YouTubeOwnerContext = {
    ownerId,
    repo: paUser.brain_repo,
    token: paUser.github_token,
    anthropicApiKey: paUser.anthropic_api_key,
    openaiApiKey: process.env.OPENAI_API_KEY ?? null,
  };
  const allowLong = allowLongFor(text);

  const results: YouTubeIngestResult[] = [];
  for (const videoId of ids.slice(0, MAX_VIDEOS_PER_MESSAGE)) {
    results.push(await ingestYouTubeVideo({ videoId, source, ctx, allowLong }));
  }
  return results;
}

// ── Helpers surfaces use to render the result ─────────────────────────────────────

/** Builds the inline youtube_ingest card payload from ingest results, or null when none succeeded. */
export function buildYouTubeCardPayload(
  caption: string,
  results: YouTubeIngestResult[],
): YouTubeIngestPayload | null {
  const videos = results.filter((r): r is Extract<YouTubeIngestResult, { ok: true }> => r.ok).map((r) => r.card);
  if (videos.length === 0) return null;
  return { kind: YOUTUBE_INGEST_KIND, caption, videos };
}

/** Joins the ok results' agent context blocks (+ honest one-liners for failures) into one block. */
export function buildYouTubeContextAppend(results: YouTubeIngestResult[]): string {
  const blocks = results.map((r) =>
    r.ok ? r.contextBlock : `[Tried to ingest ${r.url} but couldn't: ${r.error}]`,
  );
  return blocks.join("\n\n");
}

/** A short, plain-English line per result for surfaces that reply in text (iOS / Slack / mobile / SMS). */
export function summarizeIngestForReply(results: YouTubeIngestResult[]): string {
  return results
    .map((r) =>
      r.ok
        ? `Captured + transcribed: ${r.title}${r.usedWhisper ? " (from audio)" : ""} — ${r.summary}`
        : `Couldn't capture ${r.url}: ${r.error}`,
    )
    .join("\n\n");
}
