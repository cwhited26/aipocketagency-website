-- 043_youtube_watch.sql — the YouTube channel-watch layer (PA-YT-11..16).
--
-- One additive table: pa_youtube_watch records the channels an owner asked PA to watch, on what
-- cadence, and where each one last left off. A 15-minute cron (api/cron/youtube-watch) polls every
-- row whose next_poll_at is due via the channel's free Atom feed, fans new uploads through the v1.0
-- ingester, and advances next_poll_at by cadence. RSS failures bump error_count and auto-pause at 5.
--
-- The unique (owner_id, channel_id) constraint backs the upsert in lib/youtube/watch.ts so a channel
-- can't be double-watched and a re-add re-activates the existing row.

CREATE TABLE IF NOT EXISTS pa_youtube_watch (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                uuid NOT NULL,
  channel_id              text NOT NULL,
  channel_handle          text,
  display_name            text,
  avatar_url              text,
  -- realtime (~15m) | daily | weekly — drives next_poll_at scheduling.
  cadence                 text NOT NULL DEFAULT 'daily',
  last_video_id           text,
  last_video_published_at timestamptz,
  last_polled_at          timestamptz,
  next_poll_at            timestamptz,
  -- active | paused | stopped
  status                  text NOT NULL DEFAULT 'active',
  -- consecutive RSS failures; auto-pauses at 5 (lib/youtube/watch.ts WATCH_ERROR_AUTOPAUSE).
  error_count             int NOT NULL DEFAULT 0,
  -- manual | suggestion | ingest_card
  added_from              text NOT NULL DEFAULT 'manual',
  added_at                timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pa_youtube_watch_owner_channel_uidx
  ON pa_youtube_watch (owner_id, channel_id);

-- The cron's due query: active rows whose next poll has arrived.
CREATE INDEX IF NOT EXISTS pa_youtube_watch_due_idx
  ON pa_youtube_watch (status, next_poll_at);

ALTER TABLE pa_youtube_watch ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pa_youtube_watch' AND policyname = 'pa_youtube_watch_owner_rw'
  ) THEN
    CREATE POLICY pa_youtube_watch_owner_rw ON pa_youtube_watch
      FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;
