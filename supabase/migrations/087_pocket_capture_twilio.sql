-- 087_pocket_capture_twilio.sql — Pocket Capture PC-CORE-3 (SMS Inbound surface).
--
-- The SMS capture surface gives each Pocket Capture user a personal, dedicated Twilio number
-- (~$1.15/mo overhead, accepted per PA-CAPTURE-1). Texting / MMS-ing that number lands the
-- message body + any attachments in their Capture Inbox (source="sms"), with media re-uploaded
-- to Supabase Storage (Twilio's media URLs expire fast, so we copy them immediately). This
-- migration adds:
--
--   1. pa_pocket_capture_twilio_numbers — the per-owner dedicated number (one active row per
--      owner). Provisioned at Pocket Capture checkout, or lazily on first dashboard read.
--   2. pa_pocket_capture_sms_inbound_log — an append-only audit row per inbound delivery
--      (matched or not). Also the idempotency ledger: a UNIQUE message_sid collapses the
--      duplicate webhooks Twilio retries produce, so a re-fire never double-captures.
--
-- Additive + idempotent. RLS mirrors the Email Inbound tables (084): owner-scoped SELECT for the
-- dashboard; every write goes through the service-role key from the provisioner / webhook (which
-- resolves + gates ownership before inserting).

-- ── 1 · pa_pocket_capture_twilio_numbers — the per-owner dedicated number ─────────────────────────
-- One owner → one active number. twilio_phone_number is the E.164 string Twilio bought; we look
-- an inbound text's `To` up against it to resolve the owner. twilio_phone_sid is the Twilio
-- resource id used to release the number later. released_at is set (non-NULL) when a number is
-- handed back to Twilio, so an owner can re-provision without colliding on the UNIQUE constraints.
CREATE TABLE IF NOT EXISTS pa_pocket_capture_twilio_numbers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  twilio_phone_number  text NOT NULL UNIQUE,
  twilio_phone_sid     text NOT NULL UNIQUE,
  provisioned_at       timestamptz NOT NULL DEFAULT now(),
  released_at          timestamptz
);

-- An owner has at most one ACTIVE (not-yet-released) number. A partial unique index lets a
-- released number stay on the table for audit while a fresh one is provisioned.
CREATE UNIQUE INDEX IF NOT EXISTS pa_pocket_capture_twilio_numbers_owner_active_key
  ON pa_pocket_capture_twilio_numbers (owner_id)
  WHERE released_at IS NULL;

-- The webhook resolves an inbound `To` number to its owner — index the lookup.
CREATE INDEX IF NOT EXISTS pa_pocket_capture_twilio_numbers_phone_idx
  ON pa_pocket_capture_twilio_numbers (twilio_phone_number);

COMMENT ON TABLE pa_pocket_capture_twilio_numbers IS
  'Pocket Capture (PC-CORE-3) per-owner dedicated Twilio number for the SMS capture surface. One active (released_at IS NULL) row per owner.';

ALTER TABLE pa_pocket_capture_twilio_numbers ENABLE ROW LEVEL SECURITY;

-- Owner reads their own number (the dashboard surface). All writes are service-role only.
DROP POLICY IF EXISTS pa_pocket_capture_twilio_numbers_owner_select
  ON pa_pocket_capture_twilio_numbers;
CREATE POLICY pa_pocket_capture_twilio_numbers_owner_select
  ON pa_pocket_capture_twilio_numbers
  FOR SELECT USING (owner_id = auth.uid());

-- ── 2 · pa_pocket_capture_sms_inbound_log — audit + idempotency ledger ────────────────────────────
-- One row per inbound webhook delivery. owner_id is NULL for an unresolved number (we audit the
-- attempt but never process it). processed flips true once the capture is written to the brain;
-- error_text carries the reason a matched delivery did not process (e.g. no brain connected, or a
-- STOP/HELP carrier keyword we log but never capture). message_sid (Twilio's per-message id) is
-- UNIQUE: the webhook claims a delivery by inserting this row first, so a duplicate redelivery
-- hits the unique index and is skipped before any brain write happens.
CREATE TABLE IF NOT EXISTS pa_pocket_capture_sms_inbound_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  from_number   text NOT NULL,
  to_number     text NOT NULL,
  message_sid   text NOT NULL,
  message_body  text,
  media_urls    jsonb NOT NULL DEFAULT '[]'::jsonb,
  processed     boolean NOT NULL DEFAULT false,
  error_text    text,
  received_at   timestamptz NOT NULL DEFAULT now()
);

-- The idempotency claim: a duplicate Twilio redelivery collides here and is dropped.
CREATE UNIQUE INDEX IF NOT EXISTS pa_pocket_capture_sms_inbound_log_message_sid_key
  ON pa_pocket_capture_sms_inbound_log (message_sid);

-- The dashboard lists an owner's recent inbound history newest-first.
CREATE INDEX IF NOT EXISTS pa_pocket_capture_sms_inbound_log_owner_idx
  ON pa_pocket_capture_sms_inbound_log (owner_id, received_at DESC);

COMMENT ON TABLE pa_pocket_capture_sms_inbound_log IS
  'Pocket Capture (PC-CORE-3) append-only audit + idempotency ledger for inbound SMS/MMS. UNIQUE message_sid is the dedup claim. Service-role writes only.';

ALTER TABLE pa_pocket_capture_sms_inbound_log ENABLE ROW LEVEL SECURITY;

-- Owner reads their own audit rows; all writes are service-role only (bypasses RLS).
DROP POLICY IF EXISTS pa_pocket_capture_sms_inbound_log_owner_select
  ON pa_pocket_capture_sms_inbound_log;
CREATE POLICY pa_pocket_capture_sms_inbound_log_owner_select
  ON pa_pocket_capture_sms_inbound_log
  FOR SELECT USING (owner_id = auth.uid());
