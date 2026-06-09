-- 063_followup_sweeps.sql — Follow-Up Sweeps App (PA-FUS-1..6).
--
-- Positioning lock §8: Follow-Up Sweeps is the App that closes the loop on every conversation the
-- owner started and didn't finish. It watches dormant contacts across three sources (Gmail sent
-- mail, brain customer files, Lead Scout leads), drafts the next touch in the owner's voice via the
-- shipped Email Drafter, and stages each draft + one batch summary card in Mission Control.
--
-- Two new owner-scoped tables + one CHECK widen. Additive + idempotent. RLS mirrors the Lead Scout
-- tables (migration 044): owner-scoped SELECT for the dashboard; all writes go through the
-- service-role key from the cron and the API routes (which gate ownership before mutating).

-- ── 1 · pa_followup_sweep_sources — what the owner watches ─────────────────────────────────────
-- One row per configured watch. source_type picks the discovery backend; source_config carries the
-- per-type knobs (the relationship category that drives the tone, the brain directory, a Lead Scout
-- classification filter). dormancy_days is the per-source threshold (PA-FUS-1 defaults: 14 cold
-- leads / 30 active customers / 60 past customers). next_sweep_at is the cron cursor.
CREATE TABLE IF NOT EXISTS pa_followup_sweep_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source_type     text NOT NULL CHECK (source_type IN ('gmail', 'brain_customer', 'lead_scout')),
  source_config   jsonb NOT NULL DEFAULT '{}'::jsonb,
  dormancy_days   integer NOT NULL DEFAULT 14 CHECK (dormancy_days BETWEEN 1 AND 365),
  enabled         boolean NOT NULL DEFAULT true,
  last_swept_at   timestamptz,
  next_sweep_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_followup_sweep_sources_owner_idx
  ON pa_followup_sweep_sources (owner_id);
-- The cron sweeps enabled sources whose next_sweep_at is due — index that exact predicate.
CREATE INDEX IF NOT EXISTS pa_followup_sweep_sources_due_idx
  ON pa_followup_sweep_sources (next_sweep_at)
  WHERE enabled;

ALTER TABLE pa_followup_sweep_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_followup_sweep_sources_owner_select ON pa_followup_sweep_sources;
CREATE POLICY pa_followup_sweep_sources_owner_select ON pa_followup_sweep_sources
  FOR SELECT USING (owner_id = auth.uid());

-- ── 2 · pa_followup_sweep_contacts — who we've seen, and who's been left alone ──────────────────
-- One row per (source, contact email). last_touched_at is the most recent touch discovery found;
-- suppressed is the persistent "leave alone" flag (PA-FUS-5); last_drafted_at backs the 7-day
-- re-draft guard (PA-FUS-3) so a weekly sweep never re-drafts the same contact within a week.
CREATE TABLE IF NOT EXISTS pa_followup_sweep_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source_id       uuid NOT NULL REFERENCES pa_followup_sweep_sources (id) ON DELETE CASCADE,
  contact_email   text NOT NULL,
  contact_name    text,
  last_touched_at timestamptz,
  suppressed      boolean NOT NULL DEFAULT false,
  last_drafted_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- One contact row per source — discovery upserts on this so a re-sweep updates the touch date and
  -- preserves the suppressed flag rather than duplicating the contact.
  UNIQUE (source_id, contact_email)
);

CREATE INDEX IF NOT EXISTS pa_followup_sweep_contacts_owner_idx
  ON pa_followup_sweep_contacts (owner_id);
CREATE INDEX IF NOT EXISTS pa_followup_sweep_contacts_source_idx
  ON pa_followup_sweep_contacts (source_id);

ALTER TABLE pa_followup_sweep_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_followup_sweep_contacts_owner_select ON pa_followup_sweep_contacts;
CREATE POLICY pa_followup_sweep_contacts_owner_select ON pa_followup_sweep_contacts
  FOR SELECT USING (owner_id = auth.uid());

-- ── 3 · pa_inbox_items.kind — admit the follow_up_sweep_batch card ──────────────────────────────
-- The weekly sweep stages one summary card per source (PA-FUS-4) alongside the per-contact 'draft'
-- cards. CHECK history: 012 ('draft','decision'); 014 'email_triage'; 016 'persona_lead'; 021
-- 'action_approval'+'sub_agent_activity'; 023 'routine_output'; 044 'lead_scout_batch'; 046
-- 'build_action_approval'; 057 'cost_budget_gate'; 059 'skill_evolution_proposal'; 060 'gate_findings'.
-- We recreate the constraint from the full set the application's InboxKind union declares — this also
-- restores 'cost_budget_gate' and 'skill_evolution_proposal', which 060 dropped when it recreated the
-- constraint — and adds 'follow_up_sweep_batch'. Additive only; every live kind is preserved.
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
    'follow_up_sweep_batch'
  ));
