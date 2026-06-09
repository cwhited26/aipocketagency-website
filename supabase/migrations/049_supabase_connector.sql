-- 049_supabase_connector.sql — the Supabase Build Connector (PA build-tools roadmap §7.3, PA-BUILD-11).
--
-- Numbered 049: 045_project_workspaces, 046_github_build_provider, 047_lead_scout_google_maps, and
-- 048_vercel_connector landed first; never reuse a migration number (additive-only, same rule as
-- APA-ORCH-21). Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL — project haizcnyywvewjygzeaaf).
--
-- NOTE: this rewrites the provider CHECK as the COMPLETE superset (gmail … lead_scout + the three
-- build providers github_build / vercel / supabase). 048_vercel_connector's CHECK omitted
-- github_build; applying this migration after it restores github_build alongside vercel + supabase.
--
-- This connector reuses two primitives the GitHub Build lane already shipped, so this migration adds
-- only what is Supabase-specific:
--   • the 'build_action_approval' Inbox kind — introduced by 046_github_build_provider. Build actions
--     (create a Supabase project, apply a migration, seed data) stage under it via the shared
--     stageConnectorAction(); the approval route + BuildActionCard already render the full SQL.
--   • the pa_project_workspaces artifact ledger — introduced by 045_project_workspaces. A successful
--     createProject writes its supabase_project_ref there through lib/projects/workspace.ts.
--
-- What this migration adds:
--   1. the 'supabase' provider value (+ forward-declared 'vercel' for the remaining build lane) on
--      pa_connections,
--   2. the supabase_org_id column (the default org createProject targets).
--
-- Additive and non-destructive. The provider CHECK is rewritten as the full superset (not an
-- incremental edit) so it is safe to apply regardless of which connector lanes have already landed.

-- ── 1. pa_connections.provider — admit 'supabase' (+ forward-declared 'vercel') ────────────────
-- The owner's Supabase Personal Access Token (Management API) is stored AES-256-GCM-encrypted in
-- refresh_token_encrypted via lib/crypto/encrypt.ts — never plaintext. 'vercel' is forward-declared
-- so the last build lane doesn't have to re-widen the CHECK (harmless until its lane writes a row).
ALTER TABLE pa_connections DROP CONSTRAINT IF EXISTS pa_connections_provider_check;
ALTER TABLE pa_connections
  ADD CONSTRAINT pa_connections_provider_check
  CHECK (provider IN (
    'gmail', 'calendar', 'slack', 'quickbooks', 'stripe_connect', 'zoom', 'calendly',
    'lead_scout', 'github_build', 'vercel', 'supabase'
  ));

-- ── 2. supabase_org_id — the default org createProject targets ─────────────────────────────────
-- Not a secret — it is a public org identifier threaded into the Management API project-create call
-- — so it lives in its own plaintext column rather than the encrypted token blob. The org display
-- NAME reuses the shared `email` column for the card label (the same repurpose Slack uses for the
-- workspace name and QuickBooks for the company name).
ALTER TABLE pa_connections
  ADD COLUMN IF NOT EXISTS supabase_org_id TEXT;
