// log.ts — data layer for pa_podcast_ingests (migration 048), one row per successful podcast ingest
// across every inbound surface. Mirrors lib/youtube/log.ts: service-role REST, no SDK, typed result.
// Lets us see what's been ingested, from which surface, in which mode, and how many Whisper minutes it
// billed — without re-reading the brain repo. The transcript itself lives in the brain note.

type LogResult = { ok: true } | { ok: false; error: string };

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

export type PodcastIngestLogRow = {
  ownerId: string;
  showId: string;
  showTitle: string;
  episodeId: string;
  episodeTitle: string;
  brainPath: string;
  mode: "full_transcript" | "notes_only";
  transcriptChars: number;
  whisperMinutes: number;
  /** Use-case bucket the classifier assigned (competitor/tactic/testimonial/industry/default). */
  useCaseBucket: string;
  sourceInboundSurface: string;
};

/**
 * Inserts one pa_podcast_ingests row. Returns a typed result; callers treat a logging failure as
 * non-fatal (the brain note already committed) but surface it rather than swallowing. Never throws.
 */
export async function recordPodcastIngest(row: PodcastIngestLogRow): Promise<LogResult> {
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
        show_id: row.showId,
        show_title: row.showTitle,
        episode_id: row.episodeId,
        episode_title: row.episodeTitle,
        brain_path: row.brainPath,
        mode: row.mode,
        transcript_chars: row.transcriptChars,
        whisper_minutes: row.whisperMinutes,
        use_case_bucket: row.useCaseBucket,
        source_inbound_surface: row.sourceInboundSurface,
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "podcast ingest insert failed" };
  }
  if (!res.ok) return { ok: false, error: `podcast ingest insert returned ${res.status}` };
  return { ok: true };
}
