-- 086_pocket_capture_reminders.sql — Pocket Capture PC-CORE-5 (Reminders).
--
-- The reminders surface turns a reminder-shaped capture ("remind me to call the dentist in 39 min")
-- into a scheduled outbound SMS. The SMS webhook (PC-CORE-3) parses the inbound text with Haiku, and
-- when it's a confident reminder it inserts a row here instead of writing the message to the Capture
-- Inbox. A one-minute cron (/api/cron/pocket-capture-reminders) sweeps the rows whose remind_at has
-- arrived and texts the owner. This migration adds a single table:
--
--   pa_pocket_capture_reminders — one row per scheduled reminder. delivery_status drives the cron
--   sweep (only 'pending' rows due now are picked up); retry_count caps Twilio send retries at 5
--   before a row is parked as 'failed'.
--
-- Additive + idempotent. RLS mirrors the other Pocket Capture tables (084 / 087): owner-scoped
-- SELECT for the dashboard feed; every write goes through the service-role key from the webhook and
-- the cron (which resolve + gate ownership before inserting).
--
-- Columns beyond the PC-CORE-5 task's listed shape, each required to actually deliver:
--   • deliver_to / deliver_from — the destination (owner's phone) and origin (their dedicated Twilio
--     number) are captured at creation time so the cron is a single-table read and survives a later
--     number release/re-provision. The inbound SMS row (original_capture_id) is a soft FK and the
--     voice surface won't have one, so we can't rely on a join for delivery details.
--   • retry_count — "max 5 retries" needs a counter; without it a row flipped to 'failed' would never
--     be re-swept. We keep the row 'pending' and bump this until it hits 5, then park it 'failed'.

CREATE TABLE IF NOT EXISTS pa_pocket_capture_reminders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- The inbound SMS audit row this reminder was parsed from (pa_pocket_capture_sms_inbound_log.id).
  -- Soft FK (no constraint): the voice surface will create reminders without an SMS log row.
  original_capture_id uuid,
  task_text           text NOT NULL,
  remind_at           timestamptz NOT NULL,
  -- Where the reminder is delivered (owner's personal phone) and the number it's sent from (their
  -- dedicated Twilio number). Denormalized at creation so the cron needs no joins.
  deliver_to          text NOT NULL,
  deliver_from        text NOT NULL,
  -- The original inbound message verbatim ("remind me to X in 39 min") — provenance for the feed.
  source_text         text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  delivered_at        timestamptz,
  delivery_status     text NOT NULL DEFAULT 'pending'
                        CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'cancelled')),
  delivery_error      text,
  -- Failed Twilio sends bump this; at 5 the cron parks the row 'failed' and stops retrying.
  retry_count         integer NOT NULL DEFAULT 0
);

-- The cron sweep selects pending reminders whose time has arrived, newest-deadline-first irrelevant —
-- this index serves `delivery_status = 'pending' AND remind_at <= now()`.
CREATE INDEX IF NOT EXISTS pa_pocket_capture_reminders_due_idx
  ON pa_pocket_capture_reminders (delivery_status, remind_at);

-- The dashboard feed lists an owner's reminders newest-first.
CREATE INDEX IF NOT EXISTS pa_pocket_capture_reminders_owner_idx
  ON pa_pocket_capture_reminders (owner_id, created_at DESC);

COMMENT ON TABLE pa_pocket_capture_reminders IS
  'Pocket Capture (PC-CORE-5) scheduled reminders. delivery_status drives the one-minute cron sweep; retry_count caps Twilio retries at 5. Service-role writes only; owner-scoped SELECT.';

ALTER TABLE pa_pocket_capture_reminders ENABLE ROW LEVEL SECURITY;

-- Owner reads their own reminders (the dashboard feed). All writes are service-role only.
DROP POLICY IF EXISTS pa_pocket_capture_reminders_owner_select
  ON pa_pocket_capture_reminders;
CREATE POLICY pa_pocket_capture_reminders_owner_select
  ON pa_pocket_capture_reminders
  FOR SELECT USING (owner_id = auth.uid());
