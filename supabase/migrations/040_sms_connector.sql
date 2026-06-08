-- 040_sms_connector.sql — the SMS connector: a dedicated Twilio number per owner that turns
-- texting into a Pocket Agent chat surface (the phone-start lane).
--
-- One additive, non-destructive table: pa_sms_numbers binds a Twilio phone number (its SID + E.164
-- string) to a PA owner. The inbound webhook looks up the owner by the `To` number; the Settings
-- card reads the active row to show the number + status. Releasing a number flips status='released'
-- and keeps the row for history (never hard-deleted).
--
-- Message origin (where a text came in from) rides in pocket_agent_messages.metadata via
-- lib/chat/message-origin.ts (the same jsonb the Slack-DM origin uses) — no schema change needed.

CREATE TABLE IF NOT EXISTS pa_sms_numbers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL,
  twilio_phone_sid text NOT NULL,
  e164_number      text NOT NULL,
  -- active = bound + receiving · released = owner disconnected · error = Twilio rejected/lost it.
  status           text NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'released', 'error')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- A Twilio phone SID is globally unique forever — one row per SID, no double-binding.
CREATE UNIQUE INDEX IF NOT EXISTS pa_sms_numbers_phone_sid_idx
  ON pa_sms_numbers (twilio_phone_sid);

-- Inbound routing keys on the destination number; this is the hot lookup (To → owner).
CREATE INDEX IF NOT EXISTS pa_sms_numbers_e164_idx
  ON pa_sms_numbers (e164_number);

-- At most one ACTIVE number per owner (a released row doesn't count, so re-provisioning works).
CREATE UNIQUE INDEX IF NOT EXISTS pa_sms_numbers_one_active_per_owner_idx
  ON pa_sms_numbers (owner_id)
  WHERE status = 'active';
