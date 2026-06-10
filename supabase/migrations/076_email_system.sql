-- 076_email_system.sql — GTM Phase 3 onboarding + retention email system.
--
-- Four additive tables, all deny-all RLS (service-role only — every read/write goes through the
-- service-role key in cron + webhook + API routes; there's no owner-facing select surface for these).
--
--   pa_email_queue            — the scheduled-send queue the */5 cron drains.
--   pa_email_preferences      — marketing-email unsubscribe flags, keyed by email (may have no account).
--   pa_email_activation_state — which activation triggers have fired per owner (idempotency).
--   pa_cancellation_attempts  — the /cancel save-flow log (reason + whether we saved them).
--
-- Numbered 076: 075 is the Enterprise applications table (GTM Phase 2). Additive + idempotent.

-- ── pa_email_queue ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_email_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable: the Pilot is bought by a not-yet-registered visitor, so the row is keyed by email
  -- until they create an account.
  owner_id        uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  email           text NOT NULL,
  template_slug   text NOT NULL,                  -- e.g. 'onboarding.day-3-workflow'
  template_props  jsonb NOT NULL DEFAULT '{}'::jsonb,
  sequence_slug   text,                            -- e.g. 'onboarding.universal', 'pilot.nurture'
  send_at         timestamptz NOT NULL,
  sent_at         timestamptz,
  status          text NOT NULL DEFAULT 'pending', -- pending | sent | failed | cancelled
  error_text      text,
  cancel_reason   text,                            -- 'unsubscribed' | 'sequence_cancelled' | 'activation_advanced'
  attempts        smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- The sweep query: pending rows that are due, oldest first.
CREATE INDEX IF NOT EXISTS idx_pa_email_queue_due
  ON pa_email_queue (status, send_at);
-- Cancellation lookups: all pending rows in a sequence for an owner.
CREATE INDEX IF NOT EXISTS idx_pa_email_queue_owner_sequence
  ON pa_email_queue (owner_id, sequence_slug);
-- Unsubscribe path: cancel every pending row for an email.
CREATE INDEX IF NOT EXISTS idx_pa_email_queue_email
  ON pa_email_queue (email);

ALTER TABLE pa_email_queue ENABLE ROW LEVEL SECURITY;
-- No policies → deny-all. Service-role key bypasses RLS; nothing else can touch it.

COMMENT ON TABLE pa_email_queue IS
  'GTM Phase 3 email scheduler. Append-then-update queue drained by /api/cron/email-queue every 5 min. Deny-all RLS (service-role only).';

-- ── pa_email_preferences ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_email_preferences (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL,
  unsubscribed_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- One preference row per email (lowercased at write time). UNIQUE so the unsubscribe upsert is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_email_preferences_email
  ON pa_email_preferences (email);

ALTER TABLE pa_email_preferences ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pa_email_preferences IS
  'Marketing-email unsubscribe flags, keyed by email (no owner_id — the email may have no account yet). Transactional mail bypasses this. Deny-all RLS.';

-- ── pa_email_activation_state ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_email_activation_state (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trigger_slug  text NOT NULL,                    -- e.g. 'triggers.bb-no-persona'
  fired_at      timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One fired-row per (owner, trigger) so a re-running daily sweep never re-fires the same reminder.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_email_activation_owner_trigger
  ON pa_email_activation_state (owner_id, trigger_slug);

ALTER TABLE pa_email_activation_state ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pa_email_activation_state IS
  'Idempotency ledger for activation-trigger emails — which trigger has fired per owner. Deny-all RLS (service-role only).';

-- ── pa_cancellation_attempts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_cancellation_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reason      text NOT NULL,
  saved       boolean NOT NULL DEFAULT false,     -- true if the save flow kept them, false if they confirmed cancel
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_cancellation_attempts_owner
  ON pa_cancellation_attempts (owner_id, created_at DESC);

ALTER TABLE pa_cancellation_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pa_cancellation_attempts IS
  'The /cancel save-flow log: the reason picked + whether we saved the customer. Deny-all RLS (service-role only).';
