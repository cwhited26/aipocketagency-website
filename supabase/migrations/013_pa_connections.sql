-- Connections v1: per-user OAuth provider connections (Gmail first).
-- Additive migration — creates pa_connections only. Never drops anything.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL).
-- RLS: users SELECT their own rows only. INSERT/UPDATE/DELETE happen exclusively
--      via the service-role key in the OAuth callback, disconnect, and cron-sync
--      routes — token columns are never exposed to the anon/authenticated role.
--
-- Token storage: refresh_token_encrypted holds an AES-256-GCM envelope produced
-- by lib/crypto/encrypt.ts (key GMAIL_TOKEN_ENCRYPTION_KEY). The short-lived
-- access_token is cached in cleartext with its expiry so the 5-minute cron can
-- skip a refresh when it is still valid.

CREATE TABLE IF NOT EXISTS pa_connections (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider                 TEXT        NOT NULL CHECK (provider IN ('gmail')),
  email                    TEXT,
  refresh_token_encrypted  TEXT,
  access_token             TEXT,
  access_token_expires_at  TIMESTAMPTZ,
  scopes                   TEXT[],
  status                   TEXT        NOT NULL
                             CHECK (status IN ('active', 'revoked', 'error'))
                             DEFAULT 'active',
  last_sync_at             TIMESTAMPTZ,
  last_sync_history_id     TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One live connection per provider per user. Reconnecting upserts this row.
  UNIQUE (user_id, provider)
);

-- Cron hot path: "give me every active gmail connection".
CREATE INDEX IF NOT EXISTS idx_pa_connections_provider_status
  ON pa_connections (provider, status);

CREATE INDEX IF NOT EXISTS idx_pa_connections_user_id
  ON pa_connections (user_id);

ALTER TABLE pa_connections ENABLE ROW LEVEL SECURITY;

-- Users may read their own rows (the data layer only ever returns non-token
-- columns to the UI, but RLS enforces the boundary regardless).
DROP POLICY IF EXISTS "pa_connections_select_own" ON pa_connections;
CREATE POLICY "pa_connections_select_own"
  ON pa_connections
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policies: writes are denied for the anon/authenticated
-- role by default and only the service-role key (server routes) can mutate.
