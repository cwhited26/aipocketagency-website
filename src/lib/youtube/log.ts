// log.ts — data layer for pa_youtube_ingests (migration 038), one row per successful YouTube ingest
// across every inbound surface. Mirrors lib/vision/log.ts: service-role REST, no SDK, typed result.
// Lets us see what's been ingested, from which surface, and whether Whisper was needed — without
// re-reading the brain repo.

type LogResult = { ok: true } | { ok: false; error: string };

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

export type YouTubeIngestLogRow = {
  ownerId: string;
  videoId: string;
  channel: string;
  title: string;
  brainPath: string;
  transcriptChars: number;
  usedWhisper: boolean;
  sourceInboundSurface: string;
};

/**
 * Inserts one pa_youtube_ingests row. Returns a typed result; callers treat a logging failure as
 * non-fatal (the brain note already committed) but surface it rather than swallowing. Never throws.
 */
export async function recordYouTubeIngest(row: YouTubeIngestLogRow): Promise<LogResult> {
  const env = paEnv();
  if ("error" in env) return { ok: false, error: env.error };

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        owner_id: row.ownerId,
        video_id: row.videoId,
        channel: row.channel,
        title: row.title,
        brain_path: row.brainPath,
        transcript_chars: row.transcriptChars,
        used_whisper: row.usedWhisper,
        source_inbound_surface: row.sourceInboundSurface,
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "youtube ingest insert failed" };
  }
  if (!res.ok) return { ok: false, error: `youtube ingest insert returned ${res.status}` };
  return { ok: true };
}
