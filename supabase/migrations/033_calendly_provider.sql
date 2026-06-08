-- Connections: admit the Calendly provider on pa_connections.
-- Additive, idempotent migration — widens the provider CHECK so a 'calendly' row can be stored
-- alongside the existing 'gmail' / 'calendar' / 'slack' / 'quickbooks' / 'stripe_connect' / 'zoom'
-- rows, and adds the calendly_user_uri column the connector needs. Never drops anything.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL — project haizcnyywvewjygzeaaf).
--
-- What Calendly is, vs Google Calendar: Google Calendar (provider='calendar') is the OWNER's
-- personal schedule. Calendly (provider='calendly') is the booking-link infrastructure prospects
-- self-serve through (event types, scheduled events, one-off booking links). Two distinct jobs,
-- two distinct connections — the owner connects/disconnects each independently.
--
-- Why a separate row (not shared with another provider): each connection carries its own refresh
-- token + scopes + status. Token storage + RLS are unchanged from 013_pa_connections.sql
-- (service-role writes only; the refresh token is AES-256-GCM via lib/crypto/encrypt.ts). The
-- connected Calendly account's email/name is stored in the shared `email` column for display (the
-- same repurpose Slack uses for the workspace name); the connected user's resource URI
-- (https://api.calendly.com/users/<uuid> — not a secret, threaded into every Calendly API call)
-- gets its own column below.
--
-- The CHECK is rewritten as the full superset rather than an incremental edit so it is safe to
-- apply regardless of which connector lanes (calendar 022, slack 023, quickbooks 028, stripe 029,
-- zoom 032) have already landed. Listing a provider here that a lane never ships is harmless —
-- it just permits a value nothing writes yet.

ALTER TABLE pa_connections DROP CONSTRAINT IF EXISTS pa_connections_provider_check;
ALTER TABLE pa_connections
  ADD CONSTRAINT pa_connections_provider_check
  CHECK (provider IN ('gmail', 'calendar', 'slack', 'quickbooks', 'stripe_connect', 'zoom', 'calendly'));

-- Calendly user resource URI. Nullable + additive so existing rows are untouched. Not a secret
-- (it is part of the request URL/params on every Calendly API call), so it lives in its own
-- plaintext column rather than the encrypted token blob.
ALTER TABLE pa_connections
  ADD COLUMN IF NOT EXISTS calendly_user_uri TEXT;
