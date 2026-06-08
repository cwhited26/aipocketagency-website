-- Connections: admit the Slack provider on pa_connections.
-- Additive, idempotent migration — only widens the provider CHECK so a 'slack'
-- row can be stored alongside the existing 'gmail' (and Calendar's 'calendar') rows.
-- Never drops a column or a row.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL) via Supabase MCP.
--
-- Why a separate row (not shared with Gmail): each connection carries its own
-- refresh token + scopes + status, so the owner connects/disconnects Slack
-- independently (mirrors the Gmail + Calendar cards). Token storage + RLS are
-- unchanged from 013_pa_connections.sql (service-role writes only; tokens
-- AES-256-GCM via lib/crypto/encrypt.ts, reusing GMAIL_TOKEN_ENCRYPTION_KEY).
--
-- Collision note: 022_calendar_connection.sql (a sibling lane) recreates this same
-- constraint as ('gmail', 'calendar'). This migration (023) runs after it and
-- recreates the SUPERSET ('gmail', 'calendar', 'slack'), so the result is correct
-- regardless of whether the Calendar lane's migration was applied first. Including
-- 'calendar' here is harmless if that lane never ships — it just permits a value
-- nothing writes yet.

ALTER TABLE pa_connections DROP CONSTRAINT IF EXISTS pa_connections_provider_check;
ALTER TABLE pa_connections
  ADD CONSTRAINT pa_connections_provider_check
  CHECK (provider IN ('gmail', 'calendar', 'slack'));
