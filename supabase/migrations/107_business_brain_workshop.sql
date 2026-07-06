-- 107_business_brain_workshop.sql — The Business Brain Workshop evergreen funnel (PA-POS-38,
-- Positioning Lock §24). Six additive tables + one additive column, no destructive change.
--
-- The funnel: $97 workshop bundled with 30 days of Business Agent (Stripe subscription,
-- trial_period_days=30, the $97 charged immediately via add_invoice_items — the shipped Fast-Start
-- Bump mechanism). Order-form bump (+$27 Fast-Start Brain Import), OTO 1 ($997 Setup Sprint, ledgered
-- in the shipped pocket_agent_addon_purchases with kind='setup_sprint'), OTO 2 ($297 Backstage Pass).
--
-- RLS: owner reads their own rows; every write rides the service role from gated routes. Tables
-- without their own owner_id scope reads through the parent registration's owner_id. Pre-signup
-- rows (owner_id null until the webhook provisions the account) are service-role-only reads.

-- ── Registrations: one row per workshop buyer, created at checkout start ─────────────────────────
CREATE TABLE IF NOT EXISTS pa_workshop_registrations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable pre-signup: the buyer usually has no account at checkout (pay-first). The workshop
  -- webhook backfills it after resolveOrCreatePocketAgentUser runs.
  owner_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email                text NOT NULL,
  name                 text,
  stripe_customer_id   text,
  -- The Checkout Session that sold the seat. Unique so webhook retries stamp, never duplicate.
  stripe_session_id    text UNIQUE,
  chosen_slot_at       timestamptz NOT NULL,
  timezone             text NOT NULL,
  -- Whether the +$27 Fast-Start Brain Import bump was ticked on the order form. The paid ledger
  -- row lands in pa_workshop_bump_purchases when the webhook confirms the invoice line.
  bump_selected        boolean NOT NULL DEFAULT false,
  session_status       text NOT NULL DEFAULT 'registered'
                       CHECK (session_status IN ('registered','attended','no_show','canceled')),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_workshop_registrations_owner
  ON pa_workshop_registrations (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pa_workshop_registrations_slot
  ON pa_workshop_registrations (chosen_slot_at);

-- ── Attendance: one row per registration, written by the lobby + player heartbeats ───────────────
CREATE TABLE IF NOT EXISTS pa_workshop_attendance (
  registration_id            uuid PRIMARY KEY REFERENCES pa_workshop_registrations(id) ON DELETE CASCADE,
  current_video_position_sec integer NOT NULL DEFAULT 0,
  forked_repo_url            text,
  -- owner/business-brain — the Contents API target for the add-zone writes.
  forked_repo_full_name      text,
  github_login               text,
  -- The attendee's workshop GitHub OAuth token, AES-256-GCM envelope (lib/crypto/encrypt.ts).
  -- Scoped to the fork + zone writes; keyed by registration, not pa_connections, because the
  -- attendee may never have logged into PA when they click [Fork] mid-video.
  github_token_encrypted     text,
  zones_completed            text[] NOT NULL DEFAULT '{}',
  connected_to_pa            boolean NOT NULL DEFAULT false,
  exit_at                    timestamptz,
  last_active_at             timestamptz
);

-- ── Bump purchases: the +$27 Fast-Start Brain Import order-form bump ─────────────────────────────
CREATE TABLE IF NOT EXISTS pa_workshop_bump_purchases (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id       uuid NOT NULL REFERENCES pa_workshop_registrations(id) ON DELETE CASCADE,
  stripe_line_item_id   text,
  product_slug          text NOT NULL DEFAULT 'fast_start_brain_import',
  amount_cents          integer NOT NULL,
  purchased_at          timestamptz NOT NULL DEFAULT now(),
  -- One bump of a given product per registration; webhook retries merge, never double-ledger.
  UNIQUE (registration_id, product_slug)
);

-- ── OTO purchases: one row per OTO decision (yes, failed, or declined) ───────────────────────────
CREATE TABLE IF NOT EXISTS pa_workshop_oto_purchases (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id           uuid NOT NULL REFERENCES pa_workshop_registrations(id) ON DELETE CASCADE,
  oto_number                integer NOT NULL CHECK (oto_number IN (1, 2)),
  product_slug              text NOT NULL,
  amount_cents              integer NOT NULL,
  stripe_payment_intent_id  text,
  status                    text NOT NULL CHECK (status IN ('succeeded','failed','declined')),
  purchased_at              timestamptz NOT NULL DEFAULT now(),
  -- One decision per OTO per registration; a retry after a failed charge updates the row.
  UNIQUE (registration_id, oto_number)
);

-- ── Backstage Passes: OTO 2, lifetime grant (active defaults true, no expiration) ────────────────
CREATE TABLE IF NOT EXISTS pa_backstage_passes (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  registration_id           uuid REFERENCES pa_workshop_registrations(id) ON DELETE SET NULL,
  stripe_payment_intent_id  text UNIQUE,
  granted_at                timestamptz NOT NULL DEFAULT now(),
  active                    boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_pa_backstage_passes_owner
  ON pa_backstage_passes (owner_id);

-- ── Chat messages: real attendee messages, logged for Chase's later review ───────────────────────
-- These never surface in the fake-live feed (Positioning Lock §24.8 — attendees see the seeded
-- script; their own messages log here).
CREATE TABLE IF NOT EXISTS pa_workshop_chat_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id  uuid NOT NULL REFERENCES pa_workshop_registrations(id) ON DELETE CASCADE,
  sender_name      text NOT NULL,
  message          text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_workshop_chat_registration
  ON pa_workshop_chat_messages (registration_id, created_at);

-- ── trial_source on the subscription row: how this trial entered (additive column) ───────────────
ALTER TABLE pocket_agent_subscriptions
  ADD COLUMN IF NOT EXISTS trial_source text;

-- ── RLS ──────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE pa_workshop_registrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_workshop_attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_workshop_bump_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_workshop_oto_purchases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_backstage_passes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_workshop_chat_messages  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_workshop_registrations_owner_select ON pa_workshop_registrations;
CREATE POLICY pa_workshop_registrations_owner_select
  ON pa_workshop_registrations
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS pa_workshop_attendance_owner_select ON pa_workshop_attendance;
CREATE POLICY pa_workshop_attendance_owner_select
  ON pa_workshop_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pa_workshop_registrations r
      WHERE r.id = pa_workshop_attendance.registration_id AND r.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS pa_workshop_bump_purchases_owner_select ON pa_workshop_bump_purchases;
CREATE POLICY pa_workshop_bump_purchases_owner_select
  ON pa_workshop_bump_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pa_workshop_registrations r
      WHERE r.id = pa_workshop_bump_purchases.registration_id AND r.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS pa_workshop_oto_purchases_owner_select ON pa_workshop_oto_purchases;
CREATE POLICY pa_workshop_oto_purchases_owner_select
  ON pa_workshop_oto_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pa_workshop_registrations r
      WHERE r.id = pa_workshop_oto_purchases.registration_id AND r.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS pa_backstage_passes_owner_select ON pa_backstage_passes;
CREATE POLICY pa_backstage_passes_owner_select
  ON pa_backstage_passes
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS pa_workshop_chat_messages_owner_select ON pa_workshop_chat_messages;
CREATE POLICY pa_workshop_chat_messages_owner_select
  ON pa_workshop_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pa_workshop_registrations r
      WHERE r.id = pa_workshop_chat_messages.registration_id AND r.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE pa_workshop_registrations IS
  'Business Brain Workshop (PA-POS-38): one row per $97 workshop buyer. Slot-scheduled evergreen; owner_id backfilled by the workshop webhook after pay-first account resolution.';
COMMENT ON TABLE pa_workshop_attendance IS
  'Workshop player state per registration: video position heartbeats, forked repo, zones written, PA connection. The workshop GitHub OAuth token lives here (AES-256-GCM), keyed by registration.';
COMMENT ON TABLE pa_backstage_passes IS
  'OTO 2 ($297 Backstage Pass): lifetime access grant — every future workshop, behind-the-scenes videos, monthly Q&A, private Skool tier. active=true forever unless manually revoked.';
