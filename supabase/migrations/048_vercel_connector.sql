-- 048_vercel_connector.sql — the Vercel build connector (second of four build connectors).
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL — project haizcnyywvewjygzeaaf).
--
-- Numbered 048 — 045 (project_workspaces), 046 (github_build_provider), and 047
-- (lead_scout_google_maps) all landed on origin/main ahead of this lane. Never reuse a migration
-- number — additive-only, same rule as APA-ORCH-21. The Project Workspace primitive lane (045)
-- owns pa_project_workspaces — the join record this connector writes its vercel_project_id /
-- vercel_project_name back to; this file does NOT touch that table.
--
-- Additive only. Nothing drops data:
--   1. pa_connections.provider CHECK widened to admit 'vercel' (the pasted-token connection).
--   2. pa_connections.config JSONB confirmed present — the Vercel API token is stored AES-256-GCM
--      encrypted inside it ({ "token_encrypted": "v1.…", "team_id": "team_…" }). The column was
--      first added by 044_lead_scout; the IF NOT EXISTS here keeps this file self-applying whether
--      044 landed first or not. Vercel has no user-facing OAuth, so there is no refresh token —
--      one long-lived pasted token, same shape as Lead Scout's Bright Data key.
--   3. pa_inbox_items.kind CHECK widened to admit 'build_action_approval' — the Inbox card every
--      build action (create project, set env var, trigger deploy, attach domain) stages for the
--      owner to approve. Shared by the whole build-connector pack (GitHub Build, Vercel, …).
--
-- The provider + inbox CHECKs are rewritten as the FULL superset (not an incremental edit) so this
-- file applies cleanly regardless of which sibling connector / inbox lanes have already landed.

-- ── 1 + 2 · pa_connections: admit vercel + confirm the config blob ────────────────────────────────
ALTER TABLE pa_connections DROP CONSTRAINT IF EXISTS pa_connections_provider_check;
ALTER TABLE pa_connections
  ADD CONSTRAINT pa_connections_provider_check
  CHECK (provider IN (
    'gmail', 'calendar', 'slack', 'quickbooks', 'stripe_connect', 'zoom', 'calendly',
    'lead_scout', 'vercel'
  ));

ALTER TABLE pa_connections
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 3 · pa_inbox_items: admit the build_action_approval card kind ────────────────────────────────
-- CHECK history: 012 created ('draft','decision'); 014 added 'email_triage'; 016 added 'persona_lead';
-- 021 added 'action_approval' + 'sub_agent_activity'; 023 added 'routine_output'; 044 added
-- 'lead_scout_batch'. Additive only.
ALTER TABLE pa_inbox_items DROP CONSTRAINT IF EXISTS pa_inbox_items_kind_check;
ALTER TABLE pa_inbox_items
  ADD CONSTRAINT pa_inbox_items_kind_check
  CHECK (kind IN (
    'draft',
    'decision',
    'email_triage',
    'persona_lead',
    'action_approval',
    'sub_agent_activity',
    'routine_output',
    'lead_scout_batch',
    'build_action_approval'
  ));
