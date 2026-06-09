-- 050_podcast_ingest.sql — the Podcast Ingester Phase 1 (PA-PC-1..9).
-- (Numbered 050: 044 = Lead Scout, 045 = Project Workspace, 046 = GitHub Build provider,
--  047 = Lead Scout Google Maps, 048 = Vercel connector, 049 = Supabase connector were taken by
--  concurrent lanes.)
--
-- Two additive, non-destructive tables:
--
--   1. pa_podcast_ingests — one row per successful podcast ingest, from any inbound surface (Ask box,
--      iOS share, mobile capture, Slack DM, inbound email, BCC, SMS). It's analytics + provenance:
--      which show/episode, written to which brain note, how it was processed (full transcript vs the
--      cheap notes-only pass), how many Whisper minutes it billed, the use-case bucket the classifier
--      picked, and which surface it came in from. The transcript itself lives in the brain repo
--      (brain/podcasts/<show>/<date>-<slug>.md), not here.
--
--   2. pa_podcast_prefs — one row per owner: the Daily-Brief "include podcasts" opt-in, the one-time
--      chat-box first-touch hint dismissal, and the per-tier Whisper-hour budget (hours_used_this_month
--      / hours_cap) the notes-only + metered-overage layers meter against (PA-PC-4/5). Phase 1 writes
--      the ingest rows; the prefs row backs the notes-only / cap / hint affordances.
--
-- The inline ingest card rides in pocket_agent_messages.metadata, which migration 034 already added
-- (kind = 'podcast_ingest'); no schema change is needed for the card.

CREATE TABLE IF NOT EXISTS pa_podcast_ingests (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               uuid,
  show_id                text,
  show_title             text,
  episode_id             text NOT NULL,
  episode_title          text,
  brain_path             text,
  -- full_transcript | notes_only
  mode                   text NOT NULL DEFAULT 'full_transcript',
  transcript_chars       int NOT NULL DEFAULT 0,
  whisper_minutes        numeric NOT NULL DEFAULT 0,
  -- competitor | tactic | testimonial | industry | default
  use_case_bucket        text,
  -- ask_box | ios_share | mobile_capture | slack_dm | inbound_email | bcc | sms
  source_inbound_surface text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_podcast_ingests_owner_idx
  ON pa_podcast_ingests (owner_id, created_at DESC);

ALTER TABLE pa_podcast_ingests ENABLE ROW LEVEL SECURITY;

-- Owner reads their own rows; writes go through the service role (the SMS/YouTube convention — the
-- ingest happens in a headless surface that holds the service key, not the owner's session).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pa_podcast_ingests' AND policyname = 'pa_podcast_ingests_owner_read'
  ) THEN
    CREATE POLICY pa_podcast_ingests_owner_read ON pa_podcast_ingests
      FOR SELECT USING (owner_id = auth.uid());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pa_podcast_prefs (
  owner_id               uuid PRIMARY KEY,
  -- When true, the daily-brief routine appends a "Podcasts you shared (last 24h)" section.
  daily_brief_include    boolean NOT NULL DEFAULT false,
  -- Set once the owner dismisses the "you can drop podcast links here too" chat hint.
  chat_hint_dismissed_at timestamptz,
  -- Whisper minutes consumed this billing cycle (atomic increment) + the tier cap (PA-PC-4).
  hours_used_this_month  numeric NOT NULL DEFAULT 0,
  hours_cap              numeric,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pa_podcast_prefs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pa_podcast_prefs' AND policyname = 'pa_podcast_prefs_owner_rw'
  ) THEN
    CREATE POLICY pa_podcast_prefs_owner_rw ON pa_podcast_prefs
      FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;
