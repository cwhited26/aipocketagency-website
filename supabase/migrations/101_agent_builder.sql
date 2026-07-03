-- 101_agent_builder.sql (100 is held by the Credits+Top Ups sibling lane) — Custom Agent Builder (PA-POS-27, Positioning Lock §19).
--
-- The owner types a plain-English spec of an agent they need. PA composes a Persona +
-- accessible_apps + Skills + Business Brain scopes and stages the WHOLE composed agent as ONE
-- approval card in Mission Control. Approve → the composed files ride the shipped GitHub Build
-- connector (push_files, always single-approval) into the owner's OWN Business Brain repo.
-- Reject → nothing persisted. Composition surface, not code-generation: every capability is a
-- shipped PA primitive.
--
-- Additive only: one new table + the pa_inbox_items.kind constraint recreated with the new kind.

-- ── 1 · pa_agent_builds — one row per composed agent build ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_agent_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The Project Workspace this build belongs to, when composed from inside a Project. Nullable —
  -- the App surface composes workspace-free.
  workspace_id UUID,
  -- The owner's plain-English spec, verbatim.
  spec_text TEXT NOT NULL,
  -- The Zod-validated structured intent the parse step produced (what it watches / does / voice /
  -- schedule / brain zones).
  parsed_intent JSONB,
  composed_persona_slug TEXT,
  composed_apps TEXT[] NOT NULL DEFAULT '{}',
  composed_skill_slugs TEXT[] NOT NULL DEFAULT '{}',
  composed_brain_scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'rejected', 'failed')),
  approval_inbox_item_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_agent_builds_owner ON pa_agent_builds(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pa_agent_builds_status ON pa_agent_builds(owner_id, status);

ALTER TABLE pa_agent_builds ENABLE ROW LEVEL SECURITY;

-- Owner reads their own builds; all writes go through the service role (same posture as
-- pa_inbox_items — the API routes are the real gate).
DROP POLICY IF EXISTS pa_agent_builds_owner_select ON pa_agent_builds;
CREATE POLICY pa_agent_builds_owner_select ON pa_agent_builds
  FOR SELECT USING (owner_id = auth.uid());

-- ── 2 · pa_inbox_items.kind — admit the agent_builder_proposal card ─────────────────────────────
-- The one approval card carrying the whole composed agent (Persona + Apps + Skills + brain scopes
-- + the candidate Skill draft when one is needed). We recreate the constraint from the full live
-- set (last touched in 095_website_monitor_and_proposals.sql) and add the new kind. Additive only —
-- every live kind is preserved.
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
    'build_action_approval',
    'cost_budget_gate',
    'skill_evolution_proposal',
    'gate_findings',
    'follow_up_sweep_batch',
    'capture_triage_proposal',
    'ritual_result',
    'ritual_paused',
    'persona_memory_proposal',
    'soul_attribute_proposal',
    'browser_action_approval',
    'website_alert',
    'agent_builder_proposal'
  ));
