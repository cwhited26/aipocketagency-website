// feed-resolve.ts — turn a PodcastRef into an RSS feed URL (+ show metadata) we can parse.
//
// Apple Podcasts → the free, unauthenticated iTunes Lookup API resolves the show's real RSS feedUrl
// (and, when ?i= named an episode, that episode's guid + title so we ingest the right one):
//   GET https://itunes.apple.com/lookup?id=<podcastId>                       → the show (feedUrl)
//   GET https://itunes.apple.com/lookup?id=<episodeId>&entity=podcastEpisode → the episode (guid)
// RSS / audio → used directly (no resolution needed). Spotify → there is no public feed for a Spotify
// link, so we refuse honestly (PA-PC-7) rather than silently producing nothing.
//
// Direct REST, no SDK, typed results, never throws.

import type { PodcastRef } from "./detect";

const ITUNES_LOOKUP = "https://itunes.apple.com/lookup";

/** Show identity resolved from the feed/lookup — fills the card + brain-note frontmatter. */
export type ShowMeta = {
  /** A stable id for the show: the iTunes collection id, else the feed URL. */
  showId: string;
  title: string;
  host: string;
  artworkUrl: string;
};

export type ResolveResult =
  | {
      ok: true;
      /** The RSS feed URL to parse, or null for a direct-audio ref (no feed). */
      rssUrl: string | null;
      /** Set only for a direct-audio ref: the enclosure to transcribe straight away. */
      directEnclosureUrl: string | null;
      /** Best-effort show identity (enriched again from the parsed feed). */
      show: ShowMeta;
      /** When the Apple link named an episode, its feed guid (preferred) and title for selection. */
      episodeGuid: string | null;
      episodeTitleHint: string | null;
    }
  | {
      ok: false;
      reason: "spotify_exclusive" | "itunes_not_found" | "no_feed_url" | "network" | "http_error";
      message: string;
    };

type ItunesResult = {
  feedUrl?: string;
  collectionName?: string;
  trackName?: string;
  artistName?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  collectionId?: number;
  episodeGuid?: string;
  wrapperType?: string;
  kind?: string;
};
type ItunesResponse = { resultCount?: number; results?: ItunesResult[] };

async function itunesLookup(query: string): Promise<ItunesResult[] | { error: ResolveResult }> {
  let res: Response;
  try {
    res = await fetch(`${ITUNES_LOOKUP}?${query}`, {
      headers: { "User-Agent": "pocket-agent/1.0" },
      cache: "no-store",
    });
  } catch (e) {
    return {
      error: {
        ok: false,
        reason: "network",
        message: e instanceof Error ? `iTunes lookup unreachable: ${e.message}` : "iTunes lookup unreachable.",
      },
    };
  }
  if (!res.ok) {
    return { error: { ok: false, reason: "http_error", message: `iTunes lookup returned ${res.status}.` } };
  }
  const data = (await res.json()) as ItunesResponse;
  return data.results ?? [];
}

/**
 * Resolves a PodcastRef to an RSS feed (+ show identity). Apple links go through the iTunes Lookup
 * API; RSS/audio links are used as-is; Spotify links are refused with an honest reason. Never throws.
 */
export async function resolveFeed(ref: PodcastRef): Promise<ResolveResult> {
  if (ref.kind === "spotify") {
    return {
      ok: false,
      reason: "spotify_exclusive",
      message:
        "Spotify links don't expose a public feed, so I can't pull the episode audio. Share the show's Apple Podcasts link or its RSS feed and I'll listen to it.",
    };
  }

  if (ref.kind === "rss") {
    return {
      ok: true,
      rssUrl: ref.url,
      directEnclosureUrl: null,
      show: { showId: ref.url, title: "", host: "", artworkUrl: "" },
      episodeGuid: null,
      episodeTitleHint: null,
    };
  }

  if (ref.kind === "audio") {
    return {
      ok: true,
      rssUrl: null,
      directEnclosureUrl: ref.url,
      show: { showId: ref.url, title: "", host: "", artworkUrl: "" },
      episodeGuid: null,
      episodeTitleHint: null,
    };
  }

  // Apple Podcasts → iTunes Lookup for the show feedUrl.
  const showLookup = await itunesLookup(`id=${encodeURIComponent(ref.appleId)}`);
  if ("error" in showLookup) return showLookup.error;
  const show = showLookup.find((r) => r.feedUrl) ?? showLookup[0];
  if (!show) {
    return { ok: false, reason: "itunes_not_found", message: "I couldn't find that show in the podcast directory." };
  }
  if (!show.feedUrl) {
    return {
      ok: false,
      reason: "no_feed_url",
      message: "That show is in the directory but doesn't publish a public RSS feed I can read.",
    };
  }

  const showMeta: ShowMeta = {
    showId: show.collectionId ? String(show.collectionId) : show.feedUrl,
    title: (show.collectionName ?? "").trim(),
    host: (show.artistName ?? "").trim(),
    artworkUrl: show.artworkUrl600 ?? show.artworkUrl100 ?? "",
  };

  // When the link named a specific episode, resolve its guid/title so we ingest that one, not the
  // newest. A lookup miss here is non-fatal — we fall back to newest-episode selection downstream.
  let episodeGuid: string | null = null;
  let episodeTitleHint: string | null = null;
  if (ref.appleEpisodeId) {
    const epLookup = await itunesLookup(
      `id=${encodeURIComponent(ref.appleEpisodeId)}&entity=podcastEpisode`,
    );
    if (!("error" in epLookup)) {
      const ep = epLookup.find((r) => r.kind === "podcast-episode" || r.episodeGuid) ?? epLookup[0];
      if (ep) {
        episodeGuid = ep.episodeGuid ?? null;
        episodeTitleHint = (ep.trackName ?? "").trim() || null;
      }
    }
  }

  return {
    ok: true,
    rssUrl: show.feedUrl,
    directEnclosureUrl: null,
    show: showMeta,
    episodeGuid,
    episodeTitleHint,
  };
}
