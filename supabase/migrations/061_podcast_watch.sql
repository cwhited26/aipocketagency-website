-- 061_podcast_watch.sql — the Podcast Ingester show-watch layer (PA-PC-9..14).
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL — project haizcnyywvewjygzeaaf).
-- Apply AFTER 050_podcast_ingest.sql (Phase 1: pa_podcast_ingests + pa_podcast_prefs).
-- (Numbered 061: 051..060 — Lead Scout outreach/packs, Cost Observability, RAG, Decision Roundtable,
--  Skills, and Project Gates — were taken by concurrent lanes; 060 went to the Project Gates lane while
--  this one was in flight, so the watch table lands at 061. The Phase-4 pack_slug column is folded into
--  this one migration — pa_podcast_watch is a brand new table, so there's no second additive migration.)
--
-- One additive table: pa_podcast_watch records the shows an owner asked PA to follow, on what cadence,
-- whether to read just the show notes (the cheap, no-Whisper "notes-only" mode), and where each one
-- last left off. A 15-minute cron (api/cron/podcast-watch) polls every row whose next_poll_at is due
-- via the show's RSS feed, fans new episodes through the Phase-1 ingester, and advances next_poll_at by
-- cadence. RSS failures bump error_count and auto-pause the show at 5 consecutive failures — the same
-- fail-soft posture as the YouTube channel-watch layer (043).
--
-- The unique (owner_id, show_id) constraint backs the upsert in lib/podcasts/watch.ts so a show can't
-- be double-watched and a re-add re-activates (un-pauses) the existing row. "Stop watching" deletes the
-- row; pause/resume toggles `paused`.

CREATE TABLE IF NOT EXISTS pa_podcast_watch (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid NOT NULL,
  -- The resolved show id: the iTunes collection id (Apple links) or the feed URL (raw RSS links).
  show_id              text NOT NULL,
  -- The canonical show link the owner shared (Apple Podcasts page or feed URL) — shown as "Open".
  podcast_url          text,
  podcast_title        text,
  -- The RSS feed PA actually polls.
  feed_url             text NOT NULL,
  artwork_url          text,
  -- realtime (~15m) | daily | weekly — drives next_poll_at scheduling (the cron pattern from 043).
  cadence              text NOT NULL DEFAULT 'daily' CHECK (cadence IN ('realtime', 'daily', 'weekly')),
  -- Notes-only mode (PA-PC-5): classify the show notes with Haiku, skip Whisper entirely. Cost
  -- discipline for shows the owner wants topic-awareness on without paying to transcribe every episode.
  notes_only_mode      boolean NOT NULL DEFAULT false,
  -- Transcribe episodes over 120 minutes (PA-PC-6) — off by default so a 3-hour show doesn't spike cost.
  allow_long           boolean NOT NULL DEFAULT false,
  -- Cursor: the guid + pubDate of the most recent episode already ingested.
  last_episode_guid    text,
  last_episode_pub_at  timestamptz,
  last_poll_at         timestamptz,
  -- Due-poll cursor (cadence is encoded here, not in separate crons).
  next_poll_at         timestamptz,
  -- Pause/resume toggle; "stop watching" deletes the row instead.
  paused               boolean NOT NULL DEFAULT false,
  -- Consecutive RSS failures; auto-pauses at 5 (lib/podcasts/watch.ts WATCH_ERROR_AUTOPAUSE).
  error_count          int NOT NULL DEFAULT 0,
  -- The vertical curation pack this watch was subscribed from (Phase 4), or null for a hand-added show.
  pack_slug            text,
  -- manual | suggestion | ingest_card | pack
  added_from           text NOT NULL DEFAULT 'manual',
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pa_podcast_watch_owner_show_uidx
  ON pa_podcast_watch (owner_id, show_id);

-- The cron's due query: un-paused rows whose next poll has arrived.
CREATE INDEX IF NOT EXISTS pa_podcast_watch_due_idx
  ON pa_podcast_watch (paused, next_poll_at);

-- Pack membership lookups (the packs grid's "already subscribed" check) — cheap partial index that
-- skips the far-more-common hand-added shows, which leave pack_slug null.
CREATE INDEX IF NOT EXISTS pa_podcast_watch_pack_idx
  ON pa_podcast_watch (pack_slug)
  WHERE pack_slug IS NOT NULL;

ALTER TABLE pa_podcast_watch ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pa_podcast_watch' AND policyname = 'pa_podcast_watch_owner_rw'
  ) THEN
    CREATE POLICY pa_podcast_watch_owner_rw ON pa_podcast_watch
      FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;
