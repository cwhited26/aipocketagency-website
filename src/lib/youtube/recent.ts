// recent.ts — reads recent pa_youtube_ingests rows. Powers the Daily-Brief "YouTube you shared"
// section, the Mission-Control unread badge, and the YouTube surface's recent list. Service-role
// REST, no SDK, typed — mirrors lib/youtube/log.ts.

import { BUCKET_FRAMINGS, type UseCaseBucket } from "@/lib/youtube/classify";

const TABLE = "pa_youtube_ingests";

function paEnv(): { url: string; key: string } | { error: string } {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: "Supabase service-role env vars not set" };
  return { url: url.replace(/\/$/, ""), key };
}

export type RecentIngest = {
  videoId: string;
  channelId: string;
  channel: string;
  title: string;
  bucket: UseCaseBucket;
  brainPath: string;
  createdAt: string;
};

type IngestRow = {
  video_id?: string;
  channel_id?: string | null;
  channel?: string | null;
  title?: string | null;
  use_case_bucket?: string | null;
  brain_path?: string | null;
  created_at?: string;
};

function isBucket(value: string | null | undefined): value is UseCaseBucket {
  return value != null && value in BUCKET_FRAMINGS;
}

/** Fetches an owner's recent ingests, newest first. `sinceIso` bounds to a time window when set. */
export async function fetchRecentYouTubeIngests(
  ownerId: string,
  opts: { sinceIso?: string; limit?: number } = {},
): Promise<RecentIngest[]> {
  const env = paEnv();
  if ("error" in env) return [];

  const params = new URLSearchParams({
    owner_id: `eq.${ownerId}`,
    select: "video_id,channel_id,channel,title,use_case_bucket,brain_path,created_at",
    order: "created_at.desc",
    limit: String(opts.limit ?? 50),
  });
  if (opts.sinceIso) params.set("created_at", `gte.${opts.sinceIso}`);

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}?${params.toString()}`, {
      headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const rows = (await res.json()) as IngestRow[];
  return rows.map((r) => ({
    videoId: r.video_id ?? "",
    channelId: r.channel_id ?? "",
    channel: r.channel ?? "Unknown channel",
    title: r.title ?? "Untitled",
    bucket: isBucket(r.use_case_bucket) ? r.use_case_bucket : "default",
    brainPath: r.brain_path ?? "",
    createdAt: r.created_at ?? "",
  }));
}

/** Counts an owner's ingests since `sinceIso` (the Mission Control unread badge). */
export async function countRecentYouTubeIngests(ownerId: string, sinceIso: string): Promise<number> {
  const env = paEnv();
  if ("error" in env) return 0;

  const params = new URLSearchParams({
    owner_id: `eq.${ownerId}`,
    created_at: `gte.${sinceIso}`,
    select: "video_id",
  });

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}?${params.toString()}`, {
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
      cache: "no-store",
    });
  } catch {
    return 0;
  }
  if (!res.ok && res.status !== 206) return 0;
  // PostgREST returns the exact count in the Content-Range header as "0-0/<count>".
  const range = res.headers.get("content-range");
  const total = range?.split("/")[1];
  return total ? Number(total) : 0;
}

/** Renders the "YouTube you shared (last 24h)" markdown section for the Daily Brief, grouped by
 *  bucket. Returns "" when there were no ingests (the brief just omits the section). */
export function buildYouTubeBriefSection(ingests: RecentIngest[]): string {
  if (ingests.length === 0) return "";
  const lines = ingests.map((i) => {
    const label = BUCKET_FRAMINGS[i.bucket].detailLabel;
    return `- **${i.title}** — ${i.channel} _(${label})_`;
  });
  return `### YouTube you shared (last 24h)\n${lines.join("\n")}`;
}
