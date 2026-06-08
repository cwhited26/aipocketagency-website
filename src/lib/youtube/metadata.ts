// metadata.ts — fetch a video's title/channel/description/stats from the YouTube Data API v3.
//
// Direct REST:  GET https://www.googleapis.com/youtube/v3/videos
//                   ?part=snippet,contentDetails,statistics&id=<id>&key=<YOUTUBE_API_KEY>
//
// Requires the env var YOUTUBE_API_KEY (a Google Cloud API key with the "YouTube Data API v3"
// enabled). When the key is unset, or the video is private/deleted/region-blocked, we return a typed
// failure — the caller still ingests the transcript and writes the brain note from the id alone, so
// metadata is an enrichment, never a hard dependency.

export type YouTubeMetadata = {
  title: string;
  channel: string;
  channelId: string;
  /** Parsed from ISO-8601 contentDetails.duration; 0 when absent (e.g. a live stream). */
  durationSeconds: number;
  description: string;
  /** ISO-8601 publish timestamp, or "" when absent. */
  postedAt: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
};

export type MetadataResult =
  | { ok: true; metadata: YouTubeMetadata }
  | { ok: false; reason: "no_key" | "not_found" | "http_error" | "network"; message: string };

type ApiThumbnail = { url?: string; width?: number };
type ApiVideoItem = {
  snippet?: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
    description?: string;
    publishedAt?: string;
    thumbnails?: Record<string, ApiThumbnail | undefined>;
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string };
};
type ApiResponse = { items?: ApiVideoItem[] };

/** Picks the highest-resolution thumbnail the API returned. */
function bestThumbnail(thumbnails: Record<string, ApiThumbnail | undefined> | undefined): string {
  if (!thumbnails) return "";
  let best = "";
  let bestWidth = -1;
  for (const thumb of Object.values(thumbnails)) {
    if (thumb?.url && (thumb.width ?? 0) > bestWidth) {
      best = thumb.url;
      bestWidth = thumb.width ?? 0;
    }
  }
  return best;
}

/** Converts an ISO-8601 duration (e.g. PT1H2M3S) to whole seconds. Returns 0 on absence/parse miss. */
export function parseIsoDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const [, d, h, m, s] = match;
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

/**
 * Fetches metadata for a single video id. `apiKey` is the resolved YOUTUBE_API_KEY (null when
 * unset). Never throws — failures come back as a typed { ok:false } the caller can surface honestly.
 */
export async function fetchVideoMetadata(
  videoId: string,
  apiKey: string | null,
): Promise<MetadataResult> {
  if (!apiKey) {
    return {
      ok: false,
      reason: "no_key",
      message: "YOUTUBE_API_KEY is not set — saved the transcript without channel/title details.",
    };
  }

  const params = new URLSearchParams({
    part: "snippet,contentDetails,statistics",
    id: videoId,
    key: apiKey,
  });
  const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    return {
      ok: false,
      reason: "network",
      message: e instanceof Error ? `YouTube Data API unreachable: ${e.message}` : "YouTube Data API unreachable.",
    };
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 160);
    return { ok: false, reason: "http_error", message: `YouTube Data API returned ${res.status}: ${detail}` };
  }

  const data = (await res.json()) as ApiResponse;
  const item = data.items?.[0];
  if (!item || !item.snippet) {
    return { ok: false, reason: "not_found", message: "Video not found (it may be private, deleted, or region-blocked)." };
  }

  const snippet = item.snippet;
  return {
    ok: true,
    metadata: {
      title: (snippet.title ?? "").trim() || "Untitled video",
      channel: (snippet.channelTitle ?? "").trim() || "Unknown channel",
      channelId: snippet.channelId ?? "",
      durationSeconds: parseIsoDuration(item.contentDetails?.duration),
      description: (snippet.description ?? "").trim(),
      postedAt: snippet.publishedAt ?? "",
      thumbnailUrl: bestThumbnail(snippet.thumbnails),
      viewCount: Number(item.statistics?.viewCount ?? 0),
      likeCount: Number(item.statistics?.likeCount ?? 0),
    },
  };
}
