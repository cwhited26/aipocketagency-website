-- Connections: admit the Google Calendar provider on pa_connections.
-- Additive migration — only widens the provider CHECK so a 'calendar' row can be
-- stored alongside the existing 'gmail' row. Never drops anything.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL).
--
-- Why a separate row (not shared with Gmail): each Google capability is its own
-- connection with its own refresh token + scopes + status, so the owner can
-- connect/disconnect Calendar independently of Gmail (mirrors the Gmail card).
-- The Calendar grant reuses the SAME Google OAuth client (GMAIL_OAUTH_CLIENT_ID)
-- with include_granted_scopes — incremental authorization on the existing client.
-- Token storage + RLS are unchanged from 013_pa_connections.sql (service-role
-- writes only; refresh tokens AES-256-GCM via lib/crypto/encrypt.ts).

ALTER TABLE pa_connections DROP CONSTRAINT IF EXISTS pa_connections_provider_check;
ALTER TABLE pa_connections
  ADD CONSTRAINT pa_connections_provider_check
  CHECK (provider IN ('gmail', 'calendar'));
