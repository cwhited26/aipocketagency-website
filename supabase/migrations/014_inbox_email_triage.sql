-- Connections v1: let the Gmail cron sync stage incoming emails into the Inbox.
-- Additive migration — widens the pa_inbox_items.kind CHECK and adds a dedup index.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL).
-- Depends on: 012_inbox_items.sql (pa_inbox_items must already exist).
--
-- Background: 012 created pa_inbox_items with kind IN ('draft','decision'). The
-- 5-minute gmail-sync cron writes a third kind, 'email_triage', with
-- source='gmail' and payload={threadId,from,subject,snippet,url,receivedAt}.
-- These items render as triage cards (I'll handle / Draft me a reply / Archive).

ALTER TABLE pa_inbox_items
  DROP CONSTRAINT IF EXISTS pa_inbox_items_kind_check;

ALTER TABLE pa_inbox_items
  ADD CONSTRAINT pa_inbox_items_kind_check
  CHECK (kind IN ('draft', 'decision', 'email_triage'));

-- Dedup guard: at most one triage item per (user, gmail thread). The cron also
-- dedups in application code before inserting; this is defense-in-depth against
-- a concurrent double-run. Partial index keeps it scoped to triage rows only.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_inbox_gmail_thread
  ON pa_inbox_items (user_id, (payload->>'threadId'))
  WHERE kind = 'email_triage';
