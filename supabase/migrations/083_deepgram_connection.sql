-- 083_deepgram_connection.sql — Deepgram streaming transcription + transcript persistence
-- (Meeting Persona, MP-CORE-2; SPEC §9 step 2, MP-3 vendor lock = Deepgram).
--
-- Builds on the MP-CORE-1 foundation (migration 082). This lane adds the transcription layer:
-- the owner's Deepgram API key, the append-only transcript-chunk ledger streamed back from
-- Deepgram live transcription, and the audit of brain-repo transcript writes. NO end-to-end
-- orchestration here — the spawn→stream→write wiring is MP-CORE-3.
--
-- Three tables:
--   1. pa_deepgram_connections — one row per owner, same shape as pa_meeting_persona_connections:
--      AES-256-GCM-encrypted Deepgram API key (lib/connectors/deepgram/key.ts, its own env key
--      DEEPGRAM_API_KEY_ENCRYPTION_KEY per the per-surface crypto convention). UNIQUE(owner_id).
--   2. pa_meeting_transcripts — append-only chunks from Deepgram live transcription, keyed to a
--      session. Interim (is_final=false) and final (is_final=true) results both land; the brain
--      write reads finals only. RLS via a session→owner subquery (the owner reads their own
--      meeting's transcript; the streaming orchestrator writes through the service role).
--   3. pa_meeting_transcript_writes — audit of each brain-repo transcript commit. Idempotent on
--      (session_id, brain_path): a re-write overwrites the file but updates the single audit row's
--      wrote_at / commit_sha / byte_count rather than inserting a duplicate.
--
-- Additive + idempotent. Reuses the set_updated_at() trigger function introduced in 082. RLS
-- mirrors the 082 pattern: owner-scoped SELECT; every write goes through the service role.

-- ── pa_deepgram_connections ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pa_deepgram_connections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- AES-256-GCM envelope of the owner's Deepgram API key (lib/connectors/deepgram/key.ts).
  api_key_encrypted  text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_verified_at   timestamptz,
  UNIQUE (owner_id)
);

ALTER TABLE pa_deepgram_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pa_deepgram_connections'
      AND policyname = 'pa_deepgram_connections_owner_read'
  ) THEN
    CREATE POLICY pa_deepgram_connections_owner_read ON pa_deepgram_connections
      FOR SELECT USING (owner_id = auth.uid());
  END IF;
END $$;

-- ── pa_meeting_transcripts (append-only chunks) ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pa_meeting_transcripts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES pa_meeting_persona_sessions (id) ON DELETE CASCADE,
  -- Monotonic order of arrival within a session (the orchestrator assigns it).
  chunk_seq     int NOT NULL,
  -- Deepgram diarization label, e.g. "speaker_0". Nullable when diarization is off / unknown.
  speaker_label text,
  text          text NOT NULL,
  start_ms      int NOT NULL,
  end_ms        int NOT NULL,
  confidence    numeric,
  -- Deepgram interim results (is_final=false) vs finalized (is_final=true). The brain write reads
  -- finals only; interims are kept for the live per-meeting view.
  is_final      boolean NOT NULL DEFAULT true,
  received_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_meeting_transcripts_session_seq_idx
  ON pa_meeting_transcripts (session_id, chunk_seq);

ALTER TABLE pa_meeting_transcripts ENABLE ROW LEVEL SECURITY;

-- Owner reads transcripts for sessions they own (session→owner subquery). Writes are service-role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pa_meeting_transcripts'
      AND policyname = 'pa_meeting_transcripts_owner_read'
  ) THEN
    CREATE POLICY pa_meeting_transcripts_owner_read ON pa_meeting_transcripts
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM pa_meeting_persona_sessions s
          WHERE s.id = pa_meeting_transcripts.session_id
            AND s.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── pa_meeting_transcript_writes (brain-write audit) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pa_meeting_transcript_writes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES pa_meeting_persona_sessions (id) ON DELETE CASCADE,
  brain_repo  text NOT NULL,
  brain_path  text NOT NULL,
  -- Null when the commit failed (e.g. brain repo not connected) — the row still records the attempt.
  commit_sha  text,
  byte_count  int,
  wrote_at    timestamptz NOT NULL DEFAULT now(),
  -- One audit row per (session, path): a re-write upserts (updates wrote_at/commit_sha/byte_count).
  UNIQUE (session_id, brain_path)
);

CREATE INDEX IF NOT EXISTS pa_meeting_transcript_writes_session_idx
  ON pa_meeting_transcript_writes (session_id, wrote_at DESC);

ALTER TABLE pa_meeting_transcript_writes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pa_meeting_transcript_writes'
      AND policyname = 'pa_meeting_transcript_writes_owner_read'
  ) THEN
    CREATE POLICY pa_meeting_transcript_writes_owner_read ON pa_meeting_transcript_writes
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM pa_meeting_persona_sessions s
          WHERE s.id = pa_meeting_transcript_writes.session_id
            AND s.owner_id = auth.uid()
        )
      );
  END IF;
END $$;
