// meeting-persona/db.ts — data layer for the transcript tables (migration 083):
// pa_meeting_transcripts (append-only chunks) + pa_meeting_transcript_writes (brain-write audit).
//
// Service-role REST, no SDK — mirrors lib/connectors/recall-ai/db.ts. paEnv/authHeaders re-declared
// per the repo convention. The streaming orchestrator (transcribe.ts) and brain-write
// (brain-write.ts) call these through the service role.

export type DbResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const TRANSCRIPTS = "pa_meeting_transcripts";
const TRANSCRIPT_WRITES = "pa_meeting_transcript_writes";

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

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

// ── Transcript chunks ──────────────────────────────────────────────────────────────────────────

export type TranscriptChunkRow = {
  chunk_seq: number;
  speaker_label: string | null;
  text: string;
  start_ms: number;
  end_ms: number;
  confidence: number | null;
  is_final: boolean;
};

/** Append one transcript chunk streamed back from Deepgram. */
export async function appendTranscriptChunk(input: {
  sessionId: string;
  chunkSeq: number;
  speakerLabel: string | null;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number | null;
  isFinal: boolean;
}): Promise<DbResult<undefined>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TRANSCRIPTS}`, {
      method: "POST",
      headers: { ...authHeaders(env.key), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        session_id: input.sessionId,
        chunk_seq: input.chunkSeq,
        speaker_label: input.speakerLabel,
        text: input.text,
        start_ms: input.startMs,
        end_ms: input.endMs,
        confidence: input.confidence,
        is_final: input.isFinal,
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}

/** Fetch a session's transcript chunks in order. finalsOnly filters out interim results. */
export async function fetchTranscriptChunks(
  sessionId: string,
  opts?: { finalsOnly?: boolean },
): Promise<DbResult<TranscriptChunkRow[]>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  const finalFilter = opts?.finalsOnly ? "&is_final=eq.true" : "";
  let res: Response;
  try {
    res = await fetch(
      `${env.url}/rest/v1/${TRANSCRIPTS}?session_id=eq.${encodeURIComponent(sessionId)}${finalFilter}` +
        `&select=chunk_seq,speaker_label,text,start_ms,end_ms,confidence,is_final&order=chunk_seq.asc`,
      { headers: { ...authHeaders(env.key), Accept: "application/json" }, cache: "no-store" },
    );
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: (await res.json()) as TranscriptChunkRow[] };
}

// ── Brain-write audit (idempotent on (session_id, brain_path)) ───────────────────────────────────

/**
 * Upsert the brain-write audit row. Idempotent on (session_id, brain_path): a re-write updates
 * wrote_at / commit_sha / byte_count rather than inserting a duplicate (the migration's UNIQUE
 * constraint + merge-duplicates resolution). commit_sha is null when the commit failed.
 */
export async function recordTranscriptWrite(input: {
  sessionId: string;
  brainRepo: string;
  brainPath: string;
  commitSha: string | null;
  byteCount: number | null;
}): Promise<DbResult<undefined>> {
  const env = paEnv();
  if ("error" in env) return { ok: false, status: 500, error: env.error };

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TRANSCRIPT_WRITES}?on_conflict=session_id,brain_path`, {
      method: "POST",
      headers: {
        ...authHeaders(env.key),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        session_id: input.sessionId,
        brain_repo: input.brainRepo,
        brain_path: input.brainPath,
        commit_sha: input.commitSha,
        byte_count: input.byteCount,
        wrote_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, status: 502, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  return { ok: true, data: undefined };
}
