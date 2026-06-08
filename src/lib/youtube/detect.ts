// detect.ts — the single source of truth for recognizing a YouTube link anywhere in inbound text.
//
// Every inbound surface (Ask box chat, iOS share, mobile capture, Slack DM, and the not-yet-landed
// inbound-email / BCC / SMS lanes) calls extractYouTubeIds() so they all agree on what counts as a
// YouTube URL and what its canonical video id is. Pure string work — no network, fully unit-tested.
//
// Recognized forms (host may be www. / m. / music. and may use http or https):
//   youtube.com/watch?v=<id>      youtu.be/<id>
//   youtube.com/shorts/<id>       youtube.com/embed/<id>
//   youtube.com/live/<id>         youtube.com/v/<id>

/** A YouTube video id is exactly 11 URL-safe base64 characters. */
const VIDEO_ID = "[A-Za-z0-9_-]{11}";

// One regex per recognized URL shape. Each captures the 11-char id in group 1. We require the id to
// be followed by a non-id boundary (end, &, ?, /, whitespace, quote, or punctuation) so a longer
// token isn't truncated into a false positive.
const BOUNDARY = "(?![A-Za-z0-9_-])";

const PATTERNS: RegExp[] = [
  // youtu.be/<id>
  new RegExp(`youtu\\.be/(${VIDEO_ID})${BOUNDARY}`, "g"),
  // youtube.com/watch?...v=<id>  (v may not be the first query param)
  new RegExp(`youtube\\.com/watch\\?(?:[^\\s"'<>]*&)?v=(${VIDEO_ID})${BOUNDARY}`, "g"),
  // youtube.com/{shorts,embed,live,v}/<id>
  new RegExp(`youtube\\.com/(?:shorts|embed|live|v)/(${VIDEO_ID})${BOUNDARY}`, "g"),
];

/**
 * Extracts every distinct YouTube video id found in `text`, in first-seen order. Returns [] when the
 * text contains no YouTube link. Deduplicates so the same video linked twice ingests once.
 */
export function extractYouTubeIds(text: string): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const pattern of PATTERNS) {
    // Reset lastIndex defensively — these are module-level /g regexes reused across calls.
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const id = match[1];
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

/** True when the text contains at least one recognizable YouTube link. */
export function containsYouTubeUrl(text: string): boolean {
  return extractYouTubeIds(text).length > 0;
}

/** The canonical watch URL for a video id. */
export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** The default thumbnail URL for a video id (used when the Data API is unavailable). */
export function defaultThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
