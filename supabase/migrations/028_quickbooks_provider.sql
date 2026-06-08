-- Connections: admit the QuickBooks Online provider on pa_connections.
-- Additive migration — widens the provider CHECK so a 'quickbooks' row can be stored
-- alongside the existing 'gmail' / 'calendar' / 'slack' rows, and adds the realm_id
-- column QuickBooks needs (the connected company id, threaded into every QBO API path).
-- Never drops anything.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL — project haizcnyywvewjygzeaaf).
--
-- Why a separate row (not shared with another provider): each connection carries its own
-- refresh token + scopes + status, so the owner connects/disconnects QuickBooks independently
-- (mirrors the Gmail / Calendar / Slack cards). Token storage + RLS are unchanged from
-- 013_pa_connections.sql (service-role writes only; refresh tokens AES-256-GCM via
-- lib/crypto/encrypt.ts). The connected company NAME is stored in the shared `email` column
-- for display (the same repurpose Slack uses for the workspace name); the company REALM ID —
-- not a secret, needed on every request URL — gets its own column below.
--
-- The CHECK is rewritten as the full superset rather than an incremental edit so it is safe to
-- apply regardless of which connector lanes (calendar 022, slack 023) have already landed.

ALTER TABLE pa_connections DROP CONSTRAINT IF EXISTS pa_connections_provider_check;
ALTER TABLE pa_connections
  ADD CONSTRAINT pa_connections_provider_check
  CHECK (provider IN ('gmail', 'calendar', 'slack', 'quickbooks'));

-- QuickBooks company (realm) id. Nullable + additive so existing rows are untouched.
ALTER TABLE pa_connections
  ADD COLUMN IF NOT EXISTS realm_id TEXT;
