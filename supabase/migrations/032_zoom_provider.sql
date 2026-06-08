-- Connections: admit the Zoom provider on pa_connections.
-- Additive, idempotent migration — widens the provider CHECK so a 'zoom' row can be stored
-- alongside the existing rows, and adds the zoom_user_id column the connector needs. Never drops
-- anything.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL — project haizcnyywvewjygzeaaf).
--
-- Each PA owner connects THEIR own Zoom account via User-level OAuth (authorization-code flow),
-- NOT Server-to-Server (which would be one Zoom account for the whole platform). The owner's
-- refresh token (rotated on every refresh) is stored encrypted in refresh_token_encrypted
-- (AES-256-GCM, lib/crypto/encrypt.ts); the short-lived access token + expiry ride on access_token
-- / access_token_expires_at (same columns Gmail/Calendar use). Token storage + RLS are unchanged
-- from 013_pa_connections.sql (service-role writes only). The Zoom account email is stored in the
-- shared `email` column for the Connections card; the owner's Zoom user id gets its own column
-- below (it is not a secret — it is just the path segment on every /users/{userId}/meetings call).
--
-- The CHECK is rewritten as the full superset rather than an incremental edit so it is safe to
-- apply regardless of which connector lanes (calendar 022, slack 023, quickbooks 028, stripe 029)
-- have already landed. Listing a provider here that a lane never ships is harmless — it just
-- permits a value nothing writes yet.

ALTER TABLE pa_connections DROP CONSTRAINT IF EXISTS pa_connections_provider_check;
ALTER TABLE pa_connections
  ADD CONSTRAINT pa_connections_provider_check
  CHECK (provider IN ('gmail', 'calendar', 'slack', 'quickbooks', 'stripe_connect', 'zoom'));

-- The owner's Zoom user id (returned by GET /users/me at connect time). Nullable + additive so
-- existing rows are untouched. Not a secret (it is the path segment on every user-scoped meeting
-- API call), so it lives in its own plaintext column rather than the encrypted token blob.
ALTER TABLE pa_connections
  ADD COLUMN IF NOT EXISTS zoom_user_id TEXT;
