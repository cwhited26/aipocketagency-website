// itunes-search.ts — resolve a name (a creator from voice/influences, a rival from brain/competitive)
// to a real podcast via the free, unauthenticated iTunes Search API:
//
//   GET https://itunes.apple.com/search?term=<name>&media=podcast&entity=podcast&limit=1
//
// iTunes does the fuzzy name→show matching server-side, so a suggestion needs zero LLM cost — the
// brain signal is the creator/rival name, and this turns it into a concrete feed PA can follow. The
// parse is pure + unit-tested; the fetch wrapper never throws (a miss is null, not a crash).

const ITUNES_SEARCH = "https://itunes.apple.com/search";

/** A show resolved from a name — enough to render a suggestion card and create a watch. */
export type ResolvedShow = {
  /** iTunes collection id (the stable show id). */
  showId: string;
  title: string;
  host: string;
  feedUrl: string;
  artworkUrl: string;
  /** The Apple Podcasts page, for the card's "Open" link. */
  appleUrl: string;
};

type ItunesSearchResult = {
  collectionId?: number;
  collectionName?: string;
  artistName?: string;
  feedUrl?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  collectionViewUrl?: string;
};
type ItunesSearchResponse = { resultCount?: number; results?: ItunesSearchResult[] };

/** Picks the best show from an iTunes Search payload — the first result that actually has a feedUrl
 *  (a show with no public feed can't be followed). Pure; exported for unit tests. Null when none. */
export function pickShow(payload: ItunesSearchResponse): ResolvedShow | null {
  const results = payload.results ?? [];
  const hit = results.find((r) => typeof r.feedUrl === "string" && r.feedUrl.length > 0);
  if (!hit || !hit.feedUrl || !hit.collectionId) return null;
  return {
    showId: String(hit.collectionId),
    title: (hit.collectionName ?? "").trim(),
    host: (hit.artistName ?? "").trim(),
    feedUrl: hit.feedUrl,
    artworkUrl: hit.artworkUrl600 ?? hit.artworkUrl100 ?? "",
    appleUrl: hit.collectionViewUrl ?? "",
  };
}

/** Resolves a name to a show via the iTunes Search API. Returns null on no match / network error. */
export async function searchPodcast(term: string): Promise<ResolvedShow | null> {
  const query = term.trim();
  if (query.length < 2) return null;
  let res: Response;
  try {
    res = await fetch(
      `${ITUNES_SEARCH}?term=${encodeURIComponent(query)}&media=podcast&entity=podcast&limit=3`,
      { headers: { "User-Agent": "pocket-agent/1.0" }, cache: "no-store" },
    );
  } catch {
    return null; // a lookup miss is non-fatal — the suggestion just doesn't surface this round.
  }
  if (!res.ok) return null;
  const payload = (await res.json()) as ItunesSearchResponse;
  return pickShow(payload);
}
