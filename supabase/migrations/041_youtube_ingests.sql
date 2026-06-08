-- 041_youtube_ingests.sql — the YouTube ingester (PA-YT-1..6).
-- (Numbered 041: 035 mobile-capture / 036 project-workspace / 037 slack-dm / 038 mission-control /
--  039 inbound-email / 040 sms-connector were taken by concurrent lanes.)
--
-- One additive, non-destructive table: pa_youtube_ingests records one row per successful YouTube
-- ingest, from any inbound surface (Ask box chat, iOS share, mobile capture, Slack DM, and the
-- inbound-email / BCC / SMS lanes when they land). It's analytics + provenance: which video, on
-- which channel, written to which brain note, how many transcript characters, whether Whisper was
-- needed (no captions), and which surface it came in from. The transcript itself lives in the brain
-- repo (brain/youtube/<channel>/<date>-<slug>.md), not here.
--
-- The inline ingest card rides in pocket_agent_messages.metadata, which migration 034 already added
-- (kind = 'youtube_ingest'); no schema change is needed for the card.

CREATE TABLE IF NOT EXISTS pa_youtube_ingests (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               uuid,
  video_id               text NOT NULL,
  channel                text,
  title                  text,
  brain_path             text,
  transcript_chars       int NOT NULL DEFAULT 0,
  used_whisper           boolean NOT NULL DEFAULT false,
  -- ask_box | ios_share | mobile_capture | slack_dm | inbound_email | bcc | sms
  source_inbound_surface text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_youtube_ingests_owner_idx
  ON pa_youtube_ingests (owner_id, created_at DESC);
