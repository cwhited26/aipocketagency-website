-- Dev GTM — Wave 1 (BYO LLM provider system + Public REST API v1).
-- Additive migration — creates API-key, request-log, and LLM-provider-settings tables
-- only. Never drops anything. Runs in parallel with Personas Wave 2 (migration 016);
-- this file touches NONE of 016's objects.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL) via Supabase MCP after the
-- lane lands.
--
-- Scoping model: PA is one-business-per-user. `user_id` is the owner's auth user id
-- (= pocket_agent_users.id = auth.users.id). RLS lets an owner read their own rows
-- (user_id = auth.uid()). All writes go through the service-role key in server routes.
-- Public REST API requests authenticate with an opaque Bearer key validated
-- server-side against `pa_api_keys.key_hash` (SHA-256) with the service-role key on
-- every request, so a revoke takes effect within one request.

-- ── pa_api_keys ─────────────────────────────────────────────────────────────────────
-- One row per generated key. We store only the SHA-256 hash of the full key and the
-- first 8 chars (`pa_live_`-prefixed display prefix) for the management UI. The
-- plaintext key is shown to the user exactly once at generation time and never stored.
CREATE TABLE IF NOT EXISTS pa_api_keys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash      TEXT        NOT NULL,
  key_prefix    TEXT        NOT NULL,   -- first 8 chars of the full key, for display
  name          TEXT        NOT NULL,
  scopes        TEXT[]      NOT NULL DEFAULT '{}',  -- POST-origin allowlist (per-key)
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,

  -- The full key hash is globally unique (collision => bug).
  UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_pa_api_keys_user ON pa_api_keys (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pa_api_keys_hash ON pa_api_keys (key_hash);

ALTER TABLE pa_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_api_keys_select_own" ON pa_api_keys;
CREATE POLICY "pa_api_keys_select_own" ON pa_api_keys
  FOR SELECT USING (auth.uid() = user_id);

-- ── pa_api_requests_log ──────────────────────────────────────────────────────────────
-- One row per authenticated REST request. Powers per-key rate-limit windowing
-- (count rows in a trailing window) and per-key usage / billing visibility.
CREATE TABLE IF NOT EXISTS pa_api_requests_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id   UUID        NOT NULL REFERENCES pa_api_keys(id) ON DELETE CASCADE,
  endpoint     TEXT        NOT NULL,
  method       TEXT        NOT NULL,
  status_code  INTEGER     NOT NULL,
  tokens_used  INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cheap trailing-window queries: WHERE api_key_id = $1 AND created_at > now() - interval.
CREATE INDEX IF NOT EXISTS idx_pa_api_requests_log_key_time
  ON pa_api_requests_log (api_key_id, created_at DESC);

ALTER TABLE pa_api_requests_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_api_requests_log_select_own" ON pa_api_requests_log;
CREATE POLICY "pa_api_requests_log_select_own" ON pa_api_requests_log
  FOR SELECT USING (
    api_key_id IN (SELECT id FROM pa_api_keys WHERE user_id = auth.uid())
  );

-- ── pa_llm_provider_settings ─────────────────────────────────────────────────────────
-- One row per user. `encrypted_api_key` is an AES-256-GCM envelope produced by
-- lib/crypto/provider-key.ts using LLM_PROVIDER_KEY_ENCRYPTION_KEY (never the plaintext
-- BYO key). `last_error_*` is set by the dispatcher when a BYO call returns 401 so the
-- UI can surface a "your key stopped working, falling back to PA-managed" banner.
CREATE TABLE IF NOT EXISTS pa_llm_provider_settings (
  user_id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider             TEXT        NOT NULL DEFAULT 'pa_managed'
                         CHECK (provider IN (
                           'pa_managed', 'anthropic', 'openai', 'groq',
                           'custom_openai_compatible'
                         )),
  encrypted_api_key    TEXT,
  model_id             TEXT,
  custom_endpoint_url  TEXT,
  last_error_at        TIMESTAMPTZ,
  last_error_code      TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pa_llm_provider_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_llm_provider_settings_select_own" ON pa_llm_provider_settings;
CREATE POLICY "pa_llm_provider_settings_select_own" ON pa_llm_provider_settings
  FOR SELECT USING (auth.uid() = user_id);
-- Writes go through the service-role key in server routes only.
