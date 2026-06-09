-- 055_rag_zone_type_change_cursor.sql — RAG extras follow-up (PA-RAG-8). Additive, non-destructive.
-- (Numbered 055: 054 shipped the pa_rag_indexes catalog; this is the next free number.)
--
-- Two columns on the existing catalog so the daily cron can tell a file-backed zone (brain repo) from
-- a project zone (database rows) and remember exactly what each looked like at its last build:
--
--   zone_type     — 'file' for a brain-repo zone (memory, persona knowledge), 'project' for a zone
--                   backed by pa_project_memory / pa_project_references rows. The cron picks its
--                   change-detection by this: a file zone compares the brain commit that last touched
--                   the zone path, a project zone compares the newest row's timestamp.
--   change_cursor — the per-zone-type state the cron compares against to decide "did anything change
--                   since the last build?". { "commitSha": "…" } for a file zone, { "rowTimestamp":
--                   "…" } for a project zone. A zone whose cursor still matches is skipped — no
--                   embedding spend on a corpus nobody touched.
--
-- Existing rows default to zone_type='file' (every 054 zone was a brain-repo zone) and an empty
-- cursor (the first cron pass after this migration treats them as changed and rebuilds once, then
-- records the cursor and idles).

ALTER TABLE pa_rag_indexes
  ADD COLUMN IF NOT EXISTS zone_type text NOT NULL DEFAULT 'file';

ALTER TABLE pa_rag_indexes
  ADD COLUMN IF NOT EXISTS change_cursor jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN pa_rag_indexes.zone_type IS
  'file = brain-repo zone (memory / persona knowledge); project = database-backed zone (pa_project_memory / pa_project_references). Selects the cron change-detection strategy.';
COMMENT ON COLUMN pa_rag_indexes.change_cursor IS
  'Per-zone-type change-detection state the daily cron compares against last_built_at state: {"commitSha":…} for a file zone, {"rowTimestamp":…} for a project zone. Unchanged cursor → cron skips the rebuild.';
