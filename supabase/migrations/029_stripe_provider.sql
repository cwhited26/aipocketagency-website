-- Connections: admit the Stripe Connect provider on pa_connections.
-- Additive, idempotent migration — widens the provider CHECK so a 'stripe_connect' row can be
-- stored alongside the existing 'gmail' / 'calendar' / 'slack' (and the in-flight 'quickbooks')
-- rows, and adds the stripe_account_id column the connector needs. Never drops anything.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL — project haizcnyywvewjygzeaaf).
--
-- IMPORTANT — provider value is 'stripe_connect', NOT 'stripe'. This connector is the OWNER's
-- business Stripe account (each PA owner connects THEIR Stripe via Stripe Connect so PA can
-- create invoices / payment links / refunds in their account). It is deliberately distinct from
-- PA's PLATFORM Stripe (Chase's PA business billing — /api/stripe/webhook,
-- /api/pocket-agent/checkout), which never lives in pa_connections. Two separate concerns; the
-- distinct provider string keeps them from ever being conflated in a query.
--
-- Why a separate row (not shared with another provider): each connection carries its own
-- refresh token + scopes + status, so the owner connects/disconnects Stripe independently
-- (mirrors the Gmail / Calendar / Slack cards). Token storage + RLS are unchanged from
-- 013_pa_connections.sql (service-role writes only; the Connect refresh token is AES-256-GCM via
-- lib/crypto/encrypt.ts). The connected account's business display NAME is stored in the shared
-- `email` column for display (the same repurpose Slack uses for the workspace name); the
-- connected account id (acct_… — not a secret, threaded into the Stripe-Account request header)
-- gets its own column below.
--
-- The CHECK is rewritten as the full superset rather than an incremental edit so it is safe to
-- apply regardless of which connector lanes (calendar 022, slack 023, quickbooks 028) have
-- already landed. Listing a provider here that a lane never ships is harmless — it just permits
-- a value nothing writes yet.

ALTER TABLE pa_connections DROP CONSTRAINT IF EXISTS pa_connections_provider_check;
ALTER TABLE pa_connections
  ADD CONSTRAINT pa_connections_provider_check
  CHECK (provider IN ('gmail', 'calendar', 'slack', 'quickbooks', 'stripe_connect'));

-- Connected Stripe account id (acct_…). Nullable + additive so existing rows are untouched.
-- Not a secret (it is sent as the Stripe-Account header on every connected-account API call),
-- so it lives in its own plaintext column rather than the encrypted token blob.
ALTER TABLE pa_connections
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
