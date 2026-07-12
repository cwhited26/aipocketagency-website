-- 110_master_keyed_workspaces.sql — external-product key issuance for POST /api/v1/workspaces.
-- Buildout Schedule (and future external products) mint a per-workspace PA API key by calling
-- POST /api/v1/workspaces with a per-product master key. This lane adds the three tables that
-- back that endpoint.
--
-- Additive only: three new tables, no changes to existing rows/constraints. Every table is
-- service-role only (the endpoint writes through the service key). RLS is enabled with NO
-- policies so anon/authenticated get deny-all; the service role bypasses RLS.

-- One row per external product. The plaintext master key is NEVER stored — only its SHA-256 hash.
CREATE TABLE IF NOT EXISTS pa_master_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug TEXT NOT NULL UNIQUE,
  master_key_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- Lookup on presented-key auth is by hash.
CREATE INDEX IF NOT EXISTS idx_pa_master_keys_hash ON pa_master_keys (master_key_hash);

-- One row per external workspace (e.g. a Buildout Schedule workspace). The per-workspace PA
-- key is stored hashed only; the source_master_key_id identifies which external product owns it.
CREATE TABLE IF NOT EXISTS pa_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_master_key_id UUID NOT NULL REFERENCES pa_master_keys(id) ON DELETE CASCADE,
  external_workspace_id TEXT NOT NULL,
  external_slug TEXT,
  owner_email TEXT NOT NULL,
  api_key_hashed TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Identity of an external workspace is (owning product, external id). The endpoint upserts on
  -- this pair so a repeat "Connect" from the same workspace re-keys the existing row, not a dupe.
  UNIQUE (source_master_key_id, external_workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_pa_workspaces_source ON pa_workspaces (source_master_key_id);

-- Audit log — one row per call to POST /api/v1/workspaces. master_key_id is nullable so
-- unauthorized attempts (no valid master key resolved) are still recorded.
CREATE TABLE IF NOT EXISTS pa_master_key_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_key_id UUID REFERENCES pa_master_keys(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  external_workspace_id TEXT,
  ip TEXT,
  user_agent TEXT,
  status_code INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_master_key_audit_key
  ON pa_master_key_audit (master_key_id, created_at DESC);

ALTER TABLE pa_master_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_master_key_audit ENABLE ROW LEVEL SECURITY;
