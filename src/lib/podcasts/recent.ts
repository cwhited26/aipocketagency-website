// recent.ts — reads recent pa_podcast_ingests rows. Powers the watch surface's "new in 24h" chip and
// the ingest-history signal behind suggested shows (a show the owner has ingested 3+ times is one PA
// should offer to follow). Service-role REST, no SDK, typed — mirrors lib/youtube/recent.ts. The
// transcript itself lives in the brain note; this table is the index.

import { USE_CASE_BUCKETS, type UseCaseBucket } from "./classify";

const TABLE = "pa_podcast_ingests";

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

export type RecentPodcastIngest = {
  showId: string;
  showTitle: string;
  episodeTitle: string;
  bucket: UseCaseBucket;
  brainPath: string;
  createdAt: string;
};

type IngestRow = {
  show_id?: string | null;
  show_title?: string | null;
  episode_title?: string | null;
  use_case_bucket?: string | null;
  brain_path?: string | null;
  created_at?: string;
};

function isBucket(value: string | null | undefined): value is UseCaseBucket {
  return value != null && (USE_CASE_BUCKETS as readonly string[]).includes(value);
}

/** Fetches an owner's recent podcast ingests, newest first. `sinceIso` bounds to a window when set. */
export async function fetchRecentPodcastIngests(
  ownerId: string,
  opts: { sinceIso?: string; limit?: number } = {},
): Promise<RecentPodcastIngest[]> {
  const env = paEnv();
  if ("error" in env) return [];

  const params = new URLSearchParams({
    owner_id: `eq.${ownerId}`,
    select: "show_id,show_title,episode_title,use_case_bucket,brain_path,created_at",
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
    showId: r.show_id ?? "",
    showTitle: r.show_title ?? "Unknown show",
    episodeTitle: r.episode_title ?? "Untitled",
    bucket: isBucket(r.use_case_bucket) ? r.use_case_bucket : "default",
    brainPath: r.brain_path ?? "",
    createdAt: r.created_at ?? "",
  }));
}

/** Counts an owner's podcast ingests since `sinceIso` (the watch surface's "new in 24h" chip). */
export async function countRecentPodcastIngests(ownerId: string, sinceIso: string): Promise<number> {
  const env = paEnv();
  if ("error" in env) return 0;

  const params = new URLSearchParams({
    owner_id: `eq.${ownerId}`,
    created_at: `gte.${sinceIso}`,
    select: "id",
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
