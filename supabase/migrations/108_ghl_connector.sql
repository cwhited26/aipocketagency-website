-- 108_ghl_connector.sql — GHL Connector Ship 2 (Pocket Agent for GHL Agencies SPEC v1 §5, §13).
-- Additive only: four new tables, no changes to existing rows or constraints.
--
-- The agency-level OAuth connection (one per owner), the client sub-account registry the tier
-- cap enforces against, the write-action audit trail, and the webhook idempotency ledger.
-- Tokens are stored AES-256-GCM encrypted (lib/ghl/crypto.ts) — RLS exposes rows to the owner
-- but the token columns only ever hold ciphertext, and the app's public read shapes omit them.

-- ── Agency connection (one per owner; the GHL Marketplace app install) ─────────────────────
CREATE TABLE IF NOT EXISTS pa_ghl_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- GHL companyId for an agency-level install; the "agency location id" when GHL scopes the
  -- install to a single location (user_type='Location').
  agency_company_id TEXT,
  agency_location_id TEXT,
  user_type TEXT NOT NULL DEFAULT 'Company' CHECK (user_type IN ('Company', 'Location')),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'needs_reauth', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pa_ghl_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_ghl_connections_owner_select ON pa_ghl_connections;
CREATE POLICY pa_ghl_connections_owner_select ON pa_ghl_connections
  FOR SELECT USING (owner_id = auth.uid());

-- ── Client sub-account registry (location_id → name; the tier cap counts synced rows) ──────
CREATE TABLE IF NOT EXISTS pa_ghl_client_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES pa_ghl_connections(id) ON DELETE CASCADE,
  ghl_location_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  timezone TEXT,
  address TEXT,
  -- synced: inside the tier cap, actions may target it. over_cap: discovered but NOT synced —
  -- the tier cap soft-limits here (SPEC §6.4: education, never a hard error). archived: the
  -- location left the agency's GHL account; kept for the audit trail.
  sync_state TEXT NOT NULL DEFAULT 'synced' CHECK (sync_state IN ('synced', 'over_cap', 'archived')),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, ghl_location_id)
);

CREATE INDEX IF NOT EXISTS idx_pa_ghl_client_locations_owner
  ON pa_ghl_client_locations (owner_id, sync_state);

ALTER TABLE pa_ghl_client_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_ghl_client_locations_owner_select ON pa_ghl_client_locations;
CREATE POLICY pa_ghl_client_locations_owner_select ON pa_ghl_client_locations
  FOR SELECT USING (owner_id = auth.uid());

-- ── Write-action audit (approval → dispatch → outcome, per location) ───────────────────────
CREATE TABLE IF NOT EXISTS pa_ghl_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inbox_item_id UUID REFERENCES pa_inbox_items(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  ghl_location_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('executed', 'failed', 'blocked')),
  error TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_ghl_action_log_owner
  ON pa_ghl_action_log (owner_id, created_at DESC);

ALTER TABLE pa_ghl_action_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_ghl_action_log_owner_select ON pa_ghl_action_log;
CREATE POLICY pa_ghl_action_log_owner_select ON pa_ghl_action_log
  FOR SELECT USING (owner_id = auth.uid());

-- ── Webhook idempotency + audit (one row per signature-verified delivery) ──────────────────
CREATE TABLE IF NOT EXISTS pa_ghl_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- GHL's webhookId when the payload carries one; otherwise a hash-derived key. UNIQUE makes
  -- redelivery a no-op (23505 swallowed by the receiver).
  webhook_id TEXT NOT NULL UNIQUE,
  -- Nullable: a delivery for a location no owner has mapped is recorded 404-side with no owner.
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ghl_location_id TEXT,
  payload_hash TEXT NOT NULL,
  signature_scheme TEXT NOT NULL CHECK (signature_scheme IN ('ed25519', 'rsa')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pa_ghl_webhook_events_owner
  ON pa_ghl_webhook_events (owner_id, received_at DESC);

ALTER TABLE pa_ghl_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_ghl_webhook_events_owner_select ON pa_ghl_webhook_events;
CREATE POLICY pa_ghl_webhook_events_owner_select ON pa_ghl_webhook_events
  FOR SELECT USING (owner_id = auth.uid());
