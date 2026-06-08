-- Mobile capture — pa_api_keys column guard.
--
-- The mobile capture endpoint (POST /api/mobile/capture) and the Settings → API keys page
-- both read `last_used_at`, the per-key human label, and `revoked_at` off pa_api_keys.
-- Those columns were all created in migration 017_api_keys_and_llm_providers.sql:
--   • last_used_at  TIMESTAMPTZ
--   • revoked_at    TIMESTAMPTZ
--   • name          TEXT NOT NULL   ← this IS the human label shown in the UI
--
-- This migration is a defensive, additive idempotency guard: it re-asserts the two
-- nullable timestamp columns with ADD COLUMN IF NOT EXISTS so any environment that
-- applied an older partial of 017 converges. It deliberately does NOT add a separate
-- `label` column — `name` already serves that purpose, and a duplicate would be dead.
--
-- Additive-only. Never drops or rewrites. Safe to apply more than once.
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL) via Supabase MCP.

ALTER TABLE pa_api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE pa_api_keys ADD COLUMN IF NOT EXISTS revoked_at   TIMESTAMPTZ;
