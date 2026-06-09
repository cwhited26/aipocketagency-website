// detect.ts — the single source of truth for recognizing a podcast link anywhere in inbound text.
//
// Every inbound surface (Ask box chat, iOS share, mobile capture, Slack DM, inbound email, BCC, SMS)
// calls extractPodcastUrls() so they all agree on what counts as a podcast link and how to resolve it.
// Pure string work — no network, fully unit-tested. The mirror of lib/youtube/detect.ts, but a
// podcast reference is richer than a YouTube id: a link can be an Apple Podcasts page (resolve via the
// free iTunes lookup API), a Spotify show/episode (no public feed — flagged for the honest refusal),
// a raw RSS feed URL, or a direct audio enclosure URL.
//
// Recognized forms:
//   podcasts.apple.com/<locale>/podcast/<slug>/id<digits>(?i=<episodeId>)   → kind "apple"
//   music.apple.com/<locale>/podcast/<slug>/id<digits>(?i=<episodeId>)      → kind "apple"
//   open.spotify.com/(show|episode)/<base62>                                → kind "spotify"
//   <url>.rss | <url>.xml | <url>.atom | feeds.<host>/...                    → kind "rss"
//   <url>.mp3 | .m4a | .aac | .ogg (ignoring query string)                  → kind "audio"

/** A typed reference to something we can try to ingest as a podcast episode. */
export type PodcastRef =
  | { kind: "apple"; url: string; appleId: string; appleEpisodeId: string | null }
  | { kind: "spotify"; url: string; spotifyType: "show" | "episode"; spotifyId: string }
  | { kind: "rss"; url: string }
  | { kind: "audio"; url: string };

// A URL token: http(s):// up to the first whitespace or angle/quote bracket. We then parse it with
// the URL constructor so detection is structural, not a fragile mega-regex.
const URL_TOKEN = /https?:\/\/[^\s"'<>)\]]+/g;

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|wav)$/i;
const FEED_EXT = /\.(rss|xml|atom)$/i;

/** Strips a trailing sentence punctuation a URL often picks up from prose ("...id123."). */
function trimTrailingPunct(url: string): string {
  return url.replace(/[.,;:!?]+$/, "");
}

/** Classifies one already-extracted URL token into a PodcastRef, or null when it isn't a podcast link. */
export function classifyPodcastUrl(raw: string): PodcastRef | null {
  const cleaned = trimTrailingPunct(raw.trim());
  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const path = parsed.pathname;

  // Apple Podcasts — the show id is the "idNNNN" path segment; ?i= carries the episode's iTunes id.
  if (host === "podcasts.apple.com" || host === "music.apple.com") {
    const idMatch = /\/id(\d+)/.exec(path);
    if (idMatch && /\/podcast\//.test(path)) {
      const episodeParam = parsed.searchParams.get("i");
      return {
        kind: "apple",
        url: cleaned,
        appleId: idMatch[1],
        appleEpisodeId: episodeParam && /^\d+$/.test(episodeParam) ? episodeParam : null,
      };
    }
    return null;
  }

  // Spotify — flagged so feed-resolve can refuse honestly (no public RSS for Spotify-exclusive shows).
  if (host === "open.spotify.com") {
    const m = /^\/(show|episode)\/([A-Za-z0-9]+)/.exec(path);
    if (m) {
      return { kind: "spotify", url: cleaned, spotifyType: m[1] as "show" | "episode", spotifyId: m[2] };
    }
    return null;
  }

  // A direct audio enclosure URL (an episode that hyperlinks straight to its MP3).
  if (AUDIO_EXT.test(path)) {
    return { kind: "audio", url: cleaned };
  }

  // A raw RSS/Atom feed — by extension, or a conventional feed host. Conservative on purpose: we only
  // claim a feed when the shape is unambiguous, so we never hijack an ordinary web link.
  if (FEED_EXT.test(path) || host.startsWith("feeds.") || host.startsWith("feed.")) {
    return { kind: "rss", url: cleaned };
  }

  return null;
}

/**
 * Extracts every distinct podcast reference found in `text`, in first-seen order. Returns [] when the
 * text contains no podcast link. Deduplicates by URL so the same link pasted twice ingests once.
 */
export function extractPodcastUrls(text: string): PodcastRef[] {
  if (!text) return [];
  const seen = new Set<string>();
  const refs: PodcastRef[] = [];
  const matches = text.match(URL_TOKEN);
  if (!matches) return [];
  for (const token of matches) {
    const ref = classifyPodcastUrl(token);
    if (ref && !seen.has(ref.url)) {
      seen.add(ref.url);
      refs.push(ref);
    }
  }
  return refs;
}

/** True when the text contains at least one recognizable podcast link. */
export function containsPodcastUrl(text: string): boolean {
  return extractPodcastUrls(text).length > 0;
}
