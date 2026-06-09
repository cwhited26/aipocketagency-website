-- 046_github_build_provider.sql — admit the GitHub Build connector.
--
-- Additive, idempotent migration. Two CHECK widenings + nothing dropped:
--
--   1. pa_connections.provider — admit 'github_build' so the owner's full-scope GitHub OAuth grant
--      (repo / workflow / delete_repo) can be stored alongside the existing connectors. This is the
--      BUILD connector (create repos, push code, branch, open PRs) — deliberately DISTINCT from the
--      brain-read GitHub access (a single-repo PAT for the brain repo, which never lives here). No
--      new column is needed: the encrypted OAuth access token reuses refresh_token_encrypted (GitHub
--      OAuth App tokens don't expire / carry no refresh token, so there's one long-lived secret),
--      and the connected GitHub login reuses the `email` column (same repurpose Slack/Stripe use).
--
--   2. pa_inbox_items.kind — admit 'build_action_approval' so a staged BUILD action renders as its
--      own Inbox card (Build Tools SPEC §9.3). It resolves through the same approval route + detail
--      row (pa_action_approvals) + ActionApprovalCard as 'action_approval'; the distinct kind lets
--      the Inbox theme build actions and keeps the productivity/build lanes legible.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL — project haizcnyywvewjygzeaaf).
--
-- Both CHECKs are rewritten as the FULL superset (not an incremental edit) so this is safe to apply
-- regardless of which sibling connector lanes have already landed. Listing a value here that a lane
-- never ships is harmless — it just permits a value nothing writes yet.
--
-- Migration number 046: the Project Workspace lane takes 045; this build-connector lane takes the
-- next free number after the highest committed migration (044_lead_scout). Never reuse a number —
-- additive-only, same rule as APA-ORCH-21.

-- ── 1 · pa_connections: admit the github_build provider ───────────────────────────────────────────
ALTER TABLE pa_connections DROP CONSTRAINT IF EXISTS pa_connections_provider_check;
ALTER TABLE pa_connections
  ADD CONSTRAINT pa_connections_provider_check
  CHECK (provider IN (
    'gmail', 'calendar', 'slack', 'quickbooks', 'stripe_connect', 'zoom', 'calendly',
    'lead_scout', 'github_build'
  ));

-- ── 2 · pa_inbox_items: admit the build_action_approval card kind ─────────────────────────────────
-- CHECK history: 012 ('draft','decision'); 014 +'email_triage'; 016 +'persona_lead'; 021
-- +'action_approval'+'sub_agent_activity'; 023 +'routine_output'; 044 +'lead_scout_batch'.
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
