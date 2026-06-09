// ingest.ts — the podcast ingester orchestrator: one PodcastRef → a transcribed, classified brain note.
//
// Pipeline for a single reference:
//   resolveFeed (Apple → iTunes lookup feedUrl; RSS → as-is; Spotify → honest refusal) → fetchFeed +
//   selectEpisode → duration/size caps → transcribeEpisode (Whisper) → classify (Haiku) → one-paragraph
//   summary + bucket-specific extraction (Sonnet) → write a clean brain note at
//   brain/podcasts/<show>/<date>-<slug>.md (via the shared brain committer) → record the ingest
//   (pa_podcast_ingests) → return the brain path, summary, inline-card data, and a plain-text context
//   block the calling surface folds into the agent's turn so it can act on the episode.
//
// The shared surface hook (maybeIngestPodcastUrls) lives in ./hooks. Surfaces that already hold the
// owner context can call ingestPodcastEpisode directly. Direct REST, no `any`, no silent catch.

import { resolveFeed } from "./feed-resolve";
import { fetchFeed, selectEpisode } from "./rss-parser";
import { transcribeEpisode } from "./transcribe";
import { classifyEpisode, extractBucketDetail, PODCAST_BUCKET_FRAMINGS, type UseCaseBucket } from "./classify";
import { recordPodcastIngest } from "./log";
import { PODCAST_INGEST_KIND, type PodcastIngestEpisode } from "./card";
import type { PodcastRef } from "./detect";
import { commitBrainTextFile } from "@/lib/brain/absorb";

// ── Tunables ───────────────────────────────────────────────────────────────────
const CONTEXT_TRANSCRIPT_CHARS = 12_000;
const PREVIEW_TRANSCRIPT_CHARS = 8_000;
const SUMMARY_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// ── Surfaces ─────────────────────────────────────────────────────────────────────

/** Every inbound surface a podcast link can arrive on (the seven shipped text surfaces). */
export type InboundSurface =
  | "ask_box"
  | "ios_share"
  | "mobile_capture"
  | "slack_dm"
  | "inbound_email"
  | "bcc"
  | "sms";

const SURFACE_LABELS: Record<InboundSurface, string> = {
  ask_box: "the Ask box",
  ios_share: "an iOS share",
  mobile_capture: "a mobile capture",
  slack_dm: "Slack",
  inbound_email: "an inbound email",
  bcc: "a BCC'd email",
  sms: "a text message",
};

// ── Results + owner context ────────────────────────────────────────────────────

export type PodcastIngestResult =
  | {
      ok: true;
      url: string;
      title: string;
      show: string;
      brainPath: string;
      summary: string;
      /** Inline-card data for pocket_agent_messages.metadata. */
      card: PodcastIngestEpisode;
      /** Plain-text block the surface folds into the agent's turn so it reads the episode. */
      contextBlock: string;
    }
  | { ok: false; url: string; error: string };

export type PodcastOwnerContext = {
  ownerId: string;
  repo: string;
  token: string;
  anthropicApiKey: string | null;
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

/** <dir>/<show-slug>/<YYYY-MM-DD>-<episode-slug>.md — dir defaults to brain/podcasts; the classifier
 *  routes competitor/tactic/testimonial notes to their shared brain areas. */
export function brainNotePath(show: string, title: string, dateIso: string, dir = "brain/podcasts"): string {
  const showSlug = slugify(show, "unknown-show");
  const titleSlug = slugify(title, "episode");
  const date = (dateIso || new Date().toISOString()).slice(0, 10);
  return `${dir}/${showSlug}/${date}-${titleSlug}.md`;
}

// ── Summary ──────────────────────────────────────────────────────────────────────

const SUMMARY_PROMPT = `Summarize the following podcast episode in ONE tight paragraph (3-5 sentences) a busy business owner can read in ten seconds. Lead with what the episode is actually about and the most useful takeaway. Plain English, no preamble, no bullet points, no "this episode" filler — just the substance.`;

/** One-paragraph summary via Anthropic; degrades to a deterministic excerpt on no-key / API error. */
async function summarizeEpisode(
  apiKey: string | null,
  episode: { title: string; show: string; fullText: string },
): Promise<string> {
  const excerptFallback = (): string => {
    const head = episode.fullText.replace(/\s+/g, " ").trim().slice(0, 400);
    return head ? `${head}${episode.fullText.length > 400 ? "…" : ""}` : "Episode saved to your brain.";
  };
  if (!apiKey) return excerptFallback();

  const transcriptForModel = episode.fullText.slice(0, 24_000);
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `${SUMMARY_PROMPT}\n\nEpisode: "${episode.title}" — ${episode.show}\n\nTranscript:\n${transcriptForModel}`,
          },
        ],
      }),
      cache: "no-store",
    });
  } catch {
    return excerptFallback(); // deliberate degrade, not a swallow
  }
  if (!res.ok) return excerptFallback();
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim();
  return text || excerptFallback();
}

// ── Note rendering ───────────────────────────────────────────────────────────────

function buildNoteMarkdown(params: {
  url: string;
  show: string;
  host: string;
  showId: string;
  episodeId: string;
  pubDateIso: string;
  durationSeconds: number;
  title: string;
  fullText: string;
  showNotes: string;
  summary: string;
  bucket: UseCaseBucket;
  detailLabel: string;
  bucketDetail: string;
  source: InboundSurface;
  whisperMinutes: number;
  ingestedAt: string;
}): string {
  const yaml = (k: string, v: string | number | boolean): string =>
    typeof v === "string" ? `${k}: ${JSON.stringify(v)}` : `${k}: ${v}`;

  const front = [
    "---",
    yaml("show_title", params.show || "Unknown show"),
    yaml("episode_title", params.title),
    yaml("host", params.host),
    yaml("show_id", params.showId),
    yaml("episode_id", params.episodeId),
    yaml("url", params.url),
    yaml("pub_date", params.pubDateIso),
    yaml("duration_seconds", params.durationSeconds),
    yaml("mode", "full_transcript"),
    yaml("use_case_bucket", params.bucket),
    yaml("source_inbound_surface", params.source),
    yaml("whisper_minutes", params.whisperMinutes),
    yaml("ingested_at", params.ingestedAt),
    "metadata:",
    "  type: reference",
    "---",
  ].join("\n");

  const body: string[] = [`# ${params.title}`, "", `**Show:** ${params.show || "Unknown show"}`];
  if (params.host) body.push(`**Host:** ${params.host}`);
  if (params.pubDateIso) body.push(`**Published:** ${params.pubDateIso.slice(0, 10)}`);
  body.push(`**Listen:** ${params.url}`);
  body.push("", "_Transcribed from the episode audio (Whisper) — there's no free caption track for podcasts._");
  // The bucket-specific extraction leads; the generic summary follows for non-default buckets.
  body.push("", `## ${params.detailLabel}`, "", params.bucketDetail);
  if (params.bucket !== "default" && params.summary.trim() && params.summary.trim() !== params.bucketDetail.trim()) {
    body.push("", "## Summary", "", params.summary);
  }
  if (params.showNotes) body.push("", "## Show notes", "", params.showNotes);
  body.push("", "## Transcript", "", params.fullText.trim());

  return `${front}\n\n${body.join("\n")}\n`;
}

function buildContextBlock(params: {
  source: InboundSurface;
  title: string;
  show: string;
  url: string;
  brainPath: string;
  framingHeadline: string;
  detailLabel: string;
  bucketDetail: string;
  fullText: string;
}): string {
  const truncated = params.fullText.length > CONTEXT_TRANSCRIPT_CHARS;
  const transcript = params.fullText.slice(0, CONTEXT_TRANSCRIPT_CHARS);
  return [
    `[Podcast episode ingested from ${SURFACE_LABELS[params.source]}: "${params.title}" — ${params.show}]`,
    `Listen: ${params.url}`,
    `${params.framingHeadline} Saved to the brain at ${params.brainPath}.`,
    `${params.detailLabel}: ${params.bucketDetail}`,
    `Transcript${truncated ? " (excerpt — full text is in the brain note)" : ""}:`,
    transcript,
  ].join("\n");
}

// ── The override phrase that lets an owner opt past the long-episode skip (PA-PC-6). ──
export function allowLongFor(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("transcribe long") || lower.includes("allow long") || lower.includes("long episode");
}

// ── Single-episode ingest ──────────────────────────────────────────────────────────

/**
 * Ingests one podcast reference for an owner whose brain context is already resolved. Returns a typed
 * result — a success carries the brain path, summary, card data, and the agent context block; a failure
 * carries an honest reason (Spotify-exclusive, over the length/size cap, no enclosure, etc.).
 */
export async function ingestPodcastEpisode(params: {
  ref: PodcastRef;
  source: InboundSurface;
  ctx: PodcastOwnerContext;
  allowLong: boolean;
}): Promise<PodcastIngestResult> {
  const { ref, source, ctx } = params;
  const ingestedAt = new Date().toISOString();

  // 1. Resolve the feed (or refuse honestly for Spotify).
  const resolved = await resolveFeed(ref);
  if (!resolved.ok) return { ok: false, url: ref.url, error: resolved.message };

  // 2. Find the episode: parse the feed and select, or use a direct-audio enclosure.
  let show = resolved.show.title;
  let host = resolved.show.host;
  let artworkUrl = resolved.show.artworkUrl;
  let episodeId: string;
  let title: string;
  let pubDateIso: string;
  let durationSeconds: number;
  let enclosureUrl: string;
  let enclosureType: string;
  let enclosureBytes: number;
  let showNotes: string;

  if (resolved.rssUrl) {
    const feedResult = await fetchFeed(resolved.rssUrl);
    if (!feedResult.ok) return { ok: false, url: ref.url, error: `Couldn't read the show's feed: ${feedResult.error}` };
    const episode = selectEpisode(feedResult.feed.episodes, resolved.episodeGuid, resolved.episodeTitleHint);
    if (!episode) return { ok: false, url: ref.url, error: "The show's feed had no episodes I could read." };
    show = show || feedResult.feed.show.title;
    host = host || feedResult.feed.show.host;
    artworkUrl = artworkUrl || feedResult.feed.show.artworkUrl;
    episodeId = episode.guid;
    title = episode.title;
    pubDateIso = episode.pubDateIso;
    durationSeconds = episode.durationSeconds;
    enclosureUrl = episode.enclosureUrl;
    enclosureType = episode.enclosureType;
    enclosureBytes = episode.enclosureBytes;
    showNotes = episode.showNotes;
  } else if (resolved.directEnclosureUrl) {
    // A direct-audio link — no feed, minimal metadata derived from the URL.
    enclosureUrl = resolved.directEnclosureUrl;
    const fileName = decodeURIComponent(enclosureUrl.split("/").pop() ?? "episode").replace(/\.[a-z0-9]+($|\?)/i, "");
    title = fileName || "Podcast episode";
    show = show || "Podcast";
    episodeId = enclosureUrl;
    pubDateIso = "";
    durationSeconds = 0;
    enclosureType = "";
    enclosureBytes = 0;
    showNotes = "";
  } else {
    return { ok: false, url: ref.url, error: "I couldn't resolve an episode to transcribe from that link." };
  }

  // 3. Transcribe the audio (Whisper, with the duration + size + SSRF gates).
  const transcript = await transcribeEpisode({
    enclosureUrl,
    enclosureType,
    enclosureBytes,
    durationSeconds,
    allowLong: params.allowLong,
  });
  if (!transcript.ok) return { ok: false, url: ref.url, error: transcript.message };
  const fullText = transcript.fullText;

  // 4. Classify, then summarize + extract in parallel (extraction leads the card; summary backstops).
  const bucket = await classifyEpisode({
    apiKey: ctx.anthropicApiKey,
    episodeTitle: title,
    show,
    host,
    transcriptHead: fullText.slice(0, 500),
  });
  const summary = await summarizeEpisode(ctx.anthropicApiKey, { title, show, fullText });
  const bucketDetail = await extractBucketDetail({
    apiKey: ctx.anthropicApiKey,
    bucket,
    title,
    channel: host ? `${show} — ${host}` : show,
    transcript: fullText,
    genericSummary: summary,
  });
  const framing = PODCAST_BUCKET_FRAMINGS[bucket];

  // 5. Write the brain note — routed by bucket.
  const dateIso = pubDateIso || ingestedAt;
  const brainPath = brainNotePath(show, title, dateIso, framing.brainDir);
  const markdown = buildNoteMarkdown({
    url: ref.url,
    show,
    host,
    showId: resolved.show.showId,
    episodeId,
    pubDateIso,
    durationSeconds,
    title,
    fullText,
    showNotes,
    summary,
    bucket,
    detailLabel: framing.detailLabel,
    bucketDetail,
    source,
    whisperMinutes: transcript.whisperMinutes,
    ingestedAt,
  });
  const commit = await commitBrainTextFile({
    repo: ctx.repo,
    token: ctx.token,
    path: brainPath,
    content: markdown,
    commitMessage: `Pocket Agent — Podcast: ${title}`,
  });
  if (!commit.ok) return { ok: false, url: ref.url, error: `Couldn't save the episode to your brain: ${commit.error}` };

  // 6. Record the ingest (analytics + provenance). A logging miss is non-fatal — the note is saved.
  await recordPodcastIngest({
    ownerId: ctx.ownerId,
    showId: resolved.show.showId,
    showTitle: show,
    episodeId,
    episodeTitle: title,
    brainPath,
    mode: "full_transcript",
    transcriptChars: fullText.length,
    whisperMinutes: transcript.whisperMinutes,
    useCaseBucket: bucket,
    sourceInboundSurface: source,
  });

  const truncated = fullText.length > PREVIEW_TRANSCRIPT_CHARS;
  const card: PodcastIngestEpisode = {
    episodeId,
    title,
    show: show || "Podcast",
    host,
    bucket,
    framingHeadline: framing.headline,
    detailLabel: framing.detailLabel,
    bucketDetail,
    artworkUrl,
    url: ref.url,
    summary,
    brainPath,
    mode: "full_transcript",
    transcriptChars: fullText.length,
    durationSeconds,
    transcriptPreview: fullText.slice(0, PREVIEW_TRANSCRIPT_CHARS),
    truncated,
  };

  return {
    ok: true,
    url: ref.url,
    title,
    show: show || "Podcast",
    brainPath,
    summary,
    card,
    contextBlock: buildContextBlock({
      source,
      title,
      show: show || "Podcast",
      url: ref.url,
      brainPath,
      framingHeadline: framing.headline,
      detailLabel: framing.detailLabel,
      bucketDetail,
      fullText,
    }),
  };
}

/** Builds the inline podcast_ingest card payload from ingest results, or null when none succeeded. */
export function buildPodcastCardPayload(
  caption: string,
  results: PodcastIngestResult[],
): { kind: typeof PODCAST_INGEST_KIND; caption: string; episodes: PodcastIngestEpisode[] } | null {
  const episodes = results
    .filter((r): r is Extract<PodcastIngestResult, { ok: true }> => r.ok)
    .map((r) => r.card);
  if (episodes.length === 0) return null;
  return { kind: PODCAST_INGEST_KIND, caption, episodes };
}

/** Joins the ok results' agent context blocks (+ honest one-liners for failures) into one block. */
export function buildPodcastContextAppend(results: PodcastIngestResult[]): string {
  return results
    .map((r) => (r.ok ? r.contextBlock : `[Tried to ingest ${r.url} but couldn't: ${r.error}]`))
    .join("\n\n");
}

/** A short, plain-English line per result for surfaces that reply in text (iOS / Slack / mobile / SMS). */
export function summarizePodcastForReply(results: PodcastIngestResult[]): string {
  return results
    .map((r) =>
      r.ok
        ? `Listened + transcribed: ${r.title} (${r.show}) — ${r.summary}`
        : `Couldn't capture ${r.url}: ${r.error}`,
    )
    .join("\n\n");
}
