-- Phase 3b: Secrets vault + connections
-- Additive migration — creates pocket_agent_connections only. Never drops columns.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL).
-- RLS: users SELECT their own rows; INSERT/UPDATE/DELETE via service-role only
--      (all writes happen server-side in the OAuth callback + disconnect routes).

CREATE TABLE IF NOT EXISTS pocket_agent_connections (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider                TEXT        NOT NULL
                            CHECK (provider IN ('google_gmail', 'google_calendar')),
  status                  TEXT        NOT NULL
                            CHECK (status IN ('connected', 'disconnected', 'error'))
                            DEFAULT 'disconnected',
  encrypted_access_token  TEXT,
  encrypted_refresh_token TEXT,
  scopes                  TEXT[],
  account_email           TEXT,
  expires_at              TIMESTAMPTZ,
  connected_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_pac_user_id
  ON pocket_agent_connections (user_id);

ALTER TABLE pocket_agent_connections ENABLE ROW LEVEL SECURITY;

-- Users may read their own rows (status, account_email, scopes — no token columns returned
-- by the data layer, but RLS enforces the select boundary regardless).
CREATE POLICY "connections_select_own"
  ON pocket_agent_connections
  FOR SELECT
  USING (auth.uid() = user_id);

-- All writes (INSERT, UPDATE, DELETE) go through the service-role key in server
-- routes; the anon/user role has no write access to this table.
-- (No INSERT / UPDATE / DELETE policies — denied for non-service callers by default.)
