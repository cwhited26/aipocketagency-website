// rss-poller.ts — detect new uploads on a watched channel via YouTube's public Atom feed.
//
//   https://www.youtube.com/feeds/videos.xml?channel_id=<UC…>
//
// Free, no Data-API quota, updates within minutes of an upload. We parse the <entry> elements and
// compare against the watch's last_video_id to find what's new since the last poll. Pure parsing is
// exported + unit-tested; the fetch wrapper never throws (a feed hiccup is a typed failure the cron
// counts toward auto-pause, not a crash).

export type FeedEntry = {
  videoId: string;
  title: string;
  /** ISO-8601 publish timestamp. */
  published: string;
};

export type FeedResult = { ok: true; entries: FeedEntry[] } | { ok: false; error: string };

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .trim();
}

/**
 * Parses a YouTube channel Atom feed into entries, newest-first (the order YouTube returns). Exported
 * for unit tests. Returns [] for a non-feed / empty body.
 */
export function parseAtomFeed(xml: string): FeedEntry[] {
  const entries: FeedEntry[] = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const videoId =
      /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(block)?.[1]?.trim() ??
      /<id>yt:video:([^<]+)<\/id>/.exec(block)?.[1]?.trim() ??
      "";
    if (!videoId) continue;
    const title = decode(/<title>([\s\S]*?)<\/title>/.exec(block)?.[1] ?? "");
    const published = (/<published>([^<]+)<\/published>/.exec(block)?.[1] ?? "").trim();
    entries.push({ videoId, title, published });
  }
  return entries;
}

/** Fetches + parses a channel's feed. Never throws — a fetch/parse problem is a typed failure. */
export async function fetchChannelFeed(channelId: string): Promise<FeedResult> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": "pocket-agent/1.0" }, cache: "no-store" });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "feed unreachable" };
  }
  if (!res.ok) return { ok: false, error: `feed returned ${res.status}` };
  const body = await res.text();
  return { ok: true, entries: parseAtomFeed(body) };
}

/**
 * Returns the entries newer than `lastVideoId`, newest-first. The feed is newest-first, so we take
 * entries until we hit the last-seen id. When lastVideoId is null (first poll of a new watch) we
 * return only the most recent entry — so adding a watch doesn't backfill the whole channel.
 */
export function newEntriesSince(entries: FeedEntry[], lastVideoId: string | null): FeedEntry[] {
  if (entries.length === 0) return [];
  if (!lastVideoId) return [entries[0]];
  const fresh: FeedEntry[] = [];
  for (const entry of entries) {
    if (entry.videoId === lastVideoId) break;
    fresh.push(entry);
  }
  return fresh;
}
