-- 077_webinar_registrations.sql — GTM Phase 5A webinar funnel.
--
-- One additive table, deny-all RLS (service-role only — the /api/webinar/register route inserts via
-- the service-role key; there is no owner-facing select surface for registrations).
--
--   pa_webinar_registrations — one row per registered email (idempotent upsert on email).
--
-- Numbered 077: 076 is the GTM Phase 3 email system. Additive + idempotent.

CREATE TABLE IF NOT EXISTS pa_webinar_registrations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL,
  first_name          text,
  phone               text,
  registered_at       timestamptz NOT NULL DEFAULT now(),
  -- Reserved for future multi-session scheduling (one webinar slot per row). Null = the default
  -- next session.
  webinar_session_id  text,
  -- Flipped true by the live-tracking system when an attendee joins. Until that exists, every
  -- registration stays false and both the no-show and the attendee email are sent (see the register
  -- route note).
  attended            boolean NOT NULL DEFAULT false,
  replay_watched      boolean NOT NULL DEFAULT false,
  unsubscribed_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- One registration row per email (lowercased at write time) so the register upsert is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_webinar_registrations_email
  ON pa_webinar_registrations (email);

-- Reporting / recent-registrant lookups.
CREATE INDEX IF NOT EXISTS idx_pa_webinar_registrations_registered_at
  ON pa_webinar_registrations (registered_at DESC);

ALTER TABLE pa_webinar_registrations ENABLE ROW LEVEL SECURITY;
-- No policies → deny-all. Service-role key bypasses RLS; nothing else can touch it.

COMMENT ON TABLE pa_webinar_registrations IS
  'GTM Phase 5A webinar registrations. Upserted by /api/webinar/register (service-role). Deny-all RLS.';
