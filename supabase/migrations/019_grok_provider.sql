-- Dev GTM — add xAI Grok as a 6th BYO LLM provider.
-- Additive, idempotent migration: widens the pa_llm_provider_settings.provider CHECK
-- (introduced in migration 017) to admit 'grok'. Drops + re-adds the named constraint so
-- re-running is safe. Touches NO other objects.
--
-- NOTE: 'grok' = xAI's LLM (e.g. grok-4.3). Distinct from the already-allowed 'groq'
-- (Groq, the fast-inference hardware vendor for open-source models). Both are supported.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL) via Supabase MCP.

ALTER TABLE pa_llm_provider_settings
  DROP CONSTRAINT IF EXISTS pa_llm_provider_settings_provider_check;

ALTER TABLE pa_llm_provider_settings
  ADD CONSTRAINT pa_llm_provider_settings_provider_check
  CHECK (provider IN (
    'pa_managed', 'anthropic', 'openai', 'groq', 'grok', 'custom_openai_compatible'
  ));
