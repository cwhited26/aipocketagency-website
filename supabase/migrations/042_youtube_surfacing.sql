-- 042_youtube_surfacing.sql — the YouTube discoverability layer (PA-YT-7..10).
--
-- Additive, non-destructive:
--   1. pa_youtube_ingests gains use_case_bucket (the classifier's pick — competitor / tactic /
--      testimonial / industry / default) so we can refine the classifier over time, and channel_id
--      (resolved UC… id) so the watch + suggestion layers can group/derive by channel.
--   2. pa_youtube_prefs — one row per owner: the Daily-Brief "include YouTube ingests" opt-in and the
--      one-time chat-box first-touch hint dismissal. RLS: owner reads/writes only their own row.

ALTER TABLE pa_youtube_ingests
  ADD COLUMN IF NOT EXISTS use_case_bucket text,
  ADD COLUMN IF NOT EXISTS channel_id text;

CREATE TABLE IF NOT EXISTS pa_youtube_prefs (
  owner_id               uuid PRIMARY KEY,
  -- When true, the daily-brief routine appends a "YouTube you shared (last 24h)" section.
  daily_brief_include    boolean NOT NULL DEFAULT false,
  -- Set once the owner dismisses the "you can drop YouTube links here too" chat hint.
  chat_hint_dismissed_at timestamptz,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pa_youtube_prefs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pa_youtube_prefs' AND policyname = 'pa_youtube_prefs_owner_rw'
  ) THEN
    CREATE POLICY pa_youtube_prefs_owner_rw ON pa_youtube_prefs
      FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;
