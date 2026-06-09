// rss-parser.ts — parse a podcast feed into the show + its episodes.
//
// Podcast feeds are RSS 2.0 (<rss><channel><item>…); the YouTube channel-watch lane parses Atom
// (<feed><entry>…) for the same job. This parser handles RSS 2.0 fully (the podcast case) and tolerates
// Atom entries, so one primitive covers both feed dialects (PA-PC-8). Pure parsing — exported and
// unit-tested; the fetch wrapper never throws (a feed hiccup is a typed failure, not a crash).

export type PodcastEpisode = {
  /** The feed <guid> (preferred) or a synthesized id, used to match a requested episode + dedupe. */
  guid: string;
  title: string;
  /** ISO-8601 publish timestamp, or "" when the feed omits/garbles it. */
  pubDateIso: string;
  /** Episode length in seconds parsed from <itunes:duration> (seconds, MM:SS, or HH:MM:SS); 0 if absent. */
  durationSeconds: number;
  /** The audio enclosure URL (the file we transcribe); "" when the item has no enclosure. */
  enclosureUrl: string;
  enclosureType: string;
  /** Declared enclosure bytes from enclosure@length; 0 when absent. */
  enclosureBytes: number;
  /** Show notes (description / content:encoded / itunes:summary), tags stripped. */
  showNotes: string;
};

export type ParsedFeed = {
  show: { title: string; host: string; artworkUrl: string; description: string };
  episodes: PodcastEpisode[];
};

export type FeedFetchResult = { ok: true; feed: ParsedFeed } | { ok: false; error: string };

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

/** Inner text of the first <tag>…</tag> within `block`, entity-decoded + trimmed. "" when absent. */
function tagText(block: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(block);
  return m ? decodeEntities(m[1]).trim() : "";
}

/** Value of `attr` on the first `<tag …>` (self-closing or not) in `block`. "" when absent. */
function tagAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']*)["'][^>]*>`, "i");
  const m = re.exec(block);
  return m ? decodeEntities(m[1]).trim() : "";
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** RFC-822 (RSS) and ISO-8601 (Atom) both parse via Date; returns "" when unparseable. */
function toIso(raw: string): string {
  if (!raw) return "";
  const t = Date.parse(raw);
  return Number.isNaN(t) ? "" : new Date(t).toISOString();
}

/** itunes:duration is "3600" (seconds), "12:34" (MM:SS), or "1:02:03" (HH:MM:SS). 0 when unparseable. */
export function parseDuration(raw: string): number {
  const v = raw.trim();
  if (!v) return 0;
  if (/^\d+$/.test(v)) return Number(v);
  const parts = v.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function parseRssItem(block: string): PodcastEpisode {
  const enclosureUrl = tagAttr(block, "enclosure", "url");
  const notesRaw = tagText(block, "content:encoded") || tagText(block, "description") || tagText(block, "itunes:summary");
  const title = tagText(block, "title") || "Untitled episode";
  return {
    guid: tagText(block, "guid") || enclosureUrl || title,
    title,
    pubDateIso: toIso(tagText(block, "pubDate")),
    durationSeconds: parseDuration(tagText(block, "itunes:duration")),
    enclosureUrl,
    enclosureType: tagAttr(block, "enclosure", "type"),
    enclosureBytes: Number(tagAttr(block, "enclosure", "length")) || 0,
    showNotes: stripHtml(notesRaw),
  };
}

function parseAtomEntry(block: string): PodcastEpisode {
  // Atom enclosures ride on <link rel="enclosure" href type length>.
  const linkRe = /<link\b[^>]*rel=["']enclosure["'][^>]*>/i.exec(block);
  const linkTag = linkRe ? linkRe[0] : "";
  const enclosureUrl = linkTag ? tagAttr(linkTag, "link", "href") : "";
  const title = tagText(block, "title") || "Untitled episode";
  return {
    guid: tagText(block, "id") || enclosureUrl || title,
    title,
    pubDateIso: toIso(tagText(block, "published") || tagText(block, "updated")),
    durationSeconds: parseDuration(tagText(block, "itunes:duration")),
    enclosureUrl,
    enclosureType: linkTag ? tagAttr(linkTag, "link", "type") : "",
    enclosureBytes: linkTag ? Number(tagAttr(linkTag, "link", "length")) || 0 : 0,
    showNotes: stripHtml(tagText(block, "summary") || tagText(block, "content")),
  };
}

/**
 * Parses a feed body into the show + episodes (feed order — newest first by convention). Exported for
 * unit tests. Handles RSS 2.0 <item> and Atom <entry>; returns an empty episode list for a non-feed body.
 */
export function parseFeed(xml: string): ParsedFeed {
  // Channel-level show metadata sits before the first item; bound the search to that head.
  const firstItem = xml.search(/<item\b|<entry\b/i);
  const head = firstItem >= 0 ? xml.slice(0, firstItem) : xml;
  const artwork =
    tagAttr(head, "itunes:image", "href") || tagText(head, "url") || tagAttr(head, "media:thumbnail", "url");
  const show = {
    title: tagText(head, "title"),
    host: tagText(head, "itunes:author") || tagText(head, "managingEditor"),
    artworkUrl: artwork,
    description: stripHtml(tagText(head, "description") || tagText(head, "itunes:summary")),
  };

  const episodes: PodcastEpisode[] = [];
  const itemRe = /<item\b[\s\S]*?<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) episodes.push(parseRssItem(m[0]));
  if (episodes.length === 0) {
    const entryRe = /<entry\b[\s\S]*?<\/entry>/gi;
    while ((m = entryRe.exec(xml)) !== null) episodes.push(parseAtomEntry(m[0]));
  }

  return { show, episodes };
}

/** Fetches + parses a feed. Never throws — a fetch/parse problem is a typed failure. */
export async function fetchFeed(rssUrl: string): Promise<FeedFetchResult> {
  let res: Response;
  try {
    res = await fetch(rssUrl, { headers: { "User-Agent": "pocket-agent/1.0" }, cache: "no-store" });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "feed unreachable" };
  }
  if (!res.ok) return { ok: false, error: `feed returned ${res.status}` };
  const body = await res.text();
  const feed = parseFeed(body);
  if (feed.episodes.length === 0) {
    return { ok: false, error: "the feed had no episodes (it may not be a podcast RSS feed)" };
  }
  return { ok: true, feed };
}

/**
 * Selects the episode to ingest: the one matching `guid` or `titleHint` when the link named an
 * episode, else the newest (first in feed order). Returns null only for an empty list.
 */
export function selectEpisode(
  episodes: PodcastEpisode[],
  guid: string | null,
  titleHint: string | null,
): PodcastEpisode | null {
  if (episodes.length === 0) return null;
  if (guid) {
    const byGuid = episodes.find((e) => e.guid === guid);
    if (byGuid) return byGuid;
  }
  if (titleHint) {
    const wanted = titleHint.toLowerCase();
    const byTitle = episodes.find((e) => e.title.toLowerCase() === wanted);
    if (byTitle) return byTitle;
  }
  return episodes[0];
}
