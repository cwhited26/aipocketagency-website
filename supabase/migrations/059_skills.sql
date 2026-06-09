-- 059_skills.sql — Skills primitive (PA-SKILL-1..7, Skills SPEC v1).
--
-- Skills themselves are NOT stored in the database (PA-SKILL-1): a Skill is markdown in the owner's
-- brain repo at skills/<slug>/SKILL.md, with versions/ and triggered/ alongside it. The only DB
-- touches are incidental:
--
--   1. pa_inbox_items.kind CHECK widened to admit 'skill_evolution_proposal' — the LEARN phase
--      stages a proposed Skill write (new or update) as an Inbox approval card (PA-SKILL-3); the
--      proposed SKILL.md content rides in the existing payload JSONB until the owner acts on it.
--   2. pa_sub_agent_runs.untrusted_origin — the skill-poisoning defense (PA-SKILL-7, §11): a run
--      born from untrusted inbound content (email / SMS / public persona) may LOAD Skills in its
--      zone but never PROPOSE one in the LEARN phase. Defaults false (trusted) so every existing
--      and owner-initiated run is unaffected.
--
-- Additive only. Safe to re-run.

-- ── 1 · pa_inbox_items: admit the skill_evolution_proposal card kind ─────────────────────────────
-- CHECK history: 012 created ('draft','decision'); 014 added 'email_triage'; 016 added 'persona_lead';
-- 021 added 'action_approval' + 'sub_agent_activity'; 023 added 'routine_output'; 044 added
-- 'lead_scout_batch'; 046/048 added 'build_action_approval'. Additive only.
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
    'skill_evolution_proposal'
  ));

-- ── 2 · pa_sub_agent_runs: untrusted-origin flag (skill-poisoning defense) ───────────────────────
ALTER TABLE pa_sub_agent_runs
  ADD COLUMN IF NOT EXISTS untrusted_origin BOOLEAN NOT NULL DEFAULT false;
