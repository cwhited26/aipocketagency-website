// channel-resolve.ts — turn ANY YouTube channel reference into a resolved channel (v1.1 watch).
//
// Accepts: a handle (@AlexHormozi), a handle URL (youtube.com/@AlexHormozi), a channel URL
// (youtube.com/channel/UC…), a legacy custom/user URL (youtube.com/c/Name, /user/Name), or any
// video URL (watch?v= / youtu.be/ / shorts/) — for a video we read its channel id from the video
// metadata. Returns { channelId, handle, displayName, avatarUrl, subscriberCount, description }.
//
// Direct REST against the YouTube Data API v3 channels.list (reuses YOUTUBE_API_KEY from v1.0). Typed
// results, never throws — a watch can't be added without a real channel id, so we surface why.

import { extractYouTubeIds } from "@/lib/youtube/detect";
import { fetchVideoMetadata } from "@/lib/youtube/metadata";

const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";

export type ResolvedChannel = {
  channelId: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  subscriberCount: number;
  description: string;
};

export type ResolveResult =
  | { ok: true; channel: ResolvedChannel }
  | { ok: false; reason: "no_key" | "not_found" | "bad_input" | "http_error" | "network"; message: string };

type Thumb = { url?: string; width?: number };
type ChannelItem = {
  id?: string;
  snippet?: {
    title?: string;
    customUrl?: string;
    description?: string;
    thumbnails?: Record<string, Thumb | undefined>;
  };
  statistics?: { subscriberCount?: string };
};
type ChannelsResponse = { items?: ChannelItem[] };

function bestAvatar(thumbs: Record<string, Thumb | undefined> | undefined): string {
  if (!thumbs) return "";
  let best = "";
  let bestWidth = -1;
  for (const t of Object.values(thumbs)) {
    if (t?.url && (t.width ?? 0) > bestWidth) {
      best = t.url;
      bestWidth = t.width ?? 0;
    }
  }
  return best;
}

function toResolved(item: ChannelItem): ResolvedChannel {
  return {
    channelId: item.id ?? "",
    handle: (item.snippet?.customUrl ?? "").replace(/^@?/, "@"),
    displayName: (item.snippet?.title ?? "").trim() || "Unknown channel",
    avatarUrl: bestAvatar(item.snippet?.thumbnails),
    subscriberCount: Number(item.statistics?.subscriberCount ?? 0),
    description: (item.snippet?.description ?? "").trim(),
  };
}

const PART = "snippet,statistics";

/** Calls channels.list with one selector (id / forHandle / forUsername). */
async function channelsList(
  apiKey: string,
  selector: { key: "id" | "forHandle" | "forUsername"; value: string },
): Promise<ResolveResult> {
  const params = new URLSearchParams({ part: PART, key: apiKey });
  params.set(selector.key, selector.value);

  let res: Response;
  try {
    res = await fetch(`${CHANNELS_URL}?${params.toString()}`, { cache: "no-store" });
  } catch (e) {
    return { ok: false, reason: "network", message: e instanceof Error ? e.message : "channels.list unreachable" };
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 160);
    return { ok: false, reason: "http_error", message: `channels.list returned ${res.status}: ${detail}` };
  }
  const data = (await res.json()) as ChannelsResponse;
  const item = data.items?.[0];
  if (!item || !item.id) return { ok: false, reason: "not_found", message: "No channel matched that reference." };
  return { ok: true, channel: toResolved(item) };
}

/** Pulls the segment after /channel/, /c/, /user/, or the @handle, from a URL or bare handle. */
function parseChannelRef(
  input: string,
): { kind: "id"; value: string } | { kind: "handle"; value: string } | { kind: "user"; value: string } | { kind: "video" } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bare handle (@name) with no slashes.
  if (/^@[A-Za-z0-9._-]+$/.test(trimmed)) return { kind: "handle", value: trimmed };
  // Bare channel id.
  if (/^UC[A-Za-z0-9_-]{22}$/.test(trimmed)) return { kind: "id", value: trimmed };

  // A video link → resolve the channel from the video metadata.
  if (extractYouTubeIds(trimmed).length > 0) return { kind: "video" };

  const channelMatch = /youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/.exec(trimmed);
  if (channelMatch) return { kind: "id", value: channelMatch[1] };

  const handleMatch = /youtube\.com\/(@[A-Za-z0-9._-]+)/.exec(trimmed);
  if (handleMatch) return { kind: "handle", value: handleMatch[1] };

  const userMatch = /youtube\.com\/(?:c|user)\/([A-Za-z0-9._-]+)/.exec(trimmed);
  if (userMatch) return { kind: "user", value: userMatch[1] };

  return null;
}

/**
 * Resolves any channel reference to a full ResolvedChannel. `apiKey` is YOUTUBE_API_KEY (null →
 * no_key). For a video link, reads the channel id from the video's metadata, then channels.list by id.
 */
export async function resolveChannel(input: string, apiKey: string | null): Promise<ResolveResult> {
  if (!apiKey) {
    return { ok: false, reason: "no_key", message: "Set YOUTUBE_API_KEY to look up channels." };
  }

  const ref = parseChannelRef(input);
  if (!ref) return { ok: false, reason: "bad_input", message: "That doesn't look like a YouTube channel, handle, or video link." };

  if (ref.kind === "id") return channelsList(apiKey, { key: "id", value: ref.value });
  if (ref.kind === "handle") return channelsList(apiKey, { key: "forHandle", value: ref.value });
  if (ref.kind === "user") return channelsList(apiKey, { key: "forUsername", value: ref.value });

  // ref.kind === "video": resolve the channel from the video's metadata.
  const videoId = extractYouTubeIds(input)[0];
  const meta = await fetchVideoMetadata(videoId, apiKey);
  if (!meta.ok) return { ok: false, reason: "not_found", message: `Couldn't read that video's channel: ${meta.message}` };
  if (!meta.metadata.channelId) {
    return { ok: false, reason: "not_found", message: "That video didn't report a channel id." };
  }
  return channelsList(apiKey, { key: "id", value: meta.metadata.channelId });
}
