-- 096_pocket_capture_mac_sync.sql — Pocket Capture Mac App (PA-CAPTURE-MAC v0.1).
--
-- The Mac menu-bar app (pa-capture-mac/) watches the clipboard + screenshot folders and batch-syncs
-- captured items to POST /api/capture/mac-sync, authenticating with the same per-user personal API
-- token the iOS Shortcut uses (pa_pocket_capture_api_tokens, migration 088). The brain write reuses
-- the shipped inbox path (fetchFileContent + appendEntryToRaw + commitMemoryFile), tagging the entry
-- source="mac_app". This migration adds the durable idempotency + audit ledger for that endpoint:
--
--   pa_pocket_capture_mac_sync_log — one row per (owner, content_hash). The endpoint claims an item
--   by inserting this row BEFORE writing to the brain; a UNIQUE (owner_id, content_hash) collapses a
--   retried upload (the uploader re-sends until it sees a 2xx, and a lost response would otherwise
--   double-write). On a brain-write failure the claim is released (DELETE) so the retry can re-attempt;
--   on success `processed` flips true.
--
-- Additive + idempotent. RLS mirrors the email-inbound log (084): owner-scoped SELECT for any future
-- dashboard surface; every write goes through the service-role key from the endpoint, which resolves
-- + gates ownership (via the API token) before inserting.

CREATE TABLE IF NOT EXISTS pa_pocket_capture_mac_sync_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content_hash  text NOT NULL,
  kind          text NOT NULL,
  source_app    text,
  captured_at   timestamptz,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed     boolean NOT NULL DEFAULT false,
  error_text    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- The idempotency claim: a re-synced item (same owner + content hash) collides here and is reported
-- back as a duplicate instead of being written to the brain a second time.
CREATE UNIQUE INDEX IF NOT EXISTS pa_pocket_capture_mac_sync_log_owner_hash_key
  ON pa_pocket_capture_mac_sync_log (owner_id, content_hash);

-- Newest-first history per owner (for a future "Mac App activity" surface).
CREATE INDEX IF NOT EXISTS pa_pocket_capture_mac_sync_log_owner_idx
  ON pa_pocket_capture_mac_sync_log (owner_id, received_at DESC);

ALTER TABLE pa_pocket_capture_mac_sync_log ENABLE ROW LEVEL SECURITY;

-- Owner reads their own rows. All writes are service-role only (bypasses RLS) — no client
-- INSERT/UPDATE/DELETE policy is granted.
DROP POLICY IF EXISTS pa_pocket_capture_mac_sync_log_owner_select
  ON pa_pocket_capture_mac_sync_log;
CREATE POLICY pa_pocket_capture_mac_sync_log_owner_select
  ON pa_pocket_capture_mac_sync_log
  FOR SELECT USING (owner_id = auth.uid());

COMMENT ON TABLE pa_pocket_capture_mac_sync_log IS
  'Pocket Capture Mac App (PA-CAPTURE-MAC v0.1) idempotency + audit ledger for POST /api/capture/mac-sync. UNIQUE (owner_id, content_hash) makes the batch ingest exactly-once across uploader retries.';
