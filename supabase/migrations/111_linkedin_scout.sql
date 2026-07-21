-- 111_linkedin_scout.sql — LinkedIn Scout App (Pocket_Agent_LinkedIn_Scout_SPEC_v1 §5).
--
-- The LinkedIn analog of Lead Scout: search LinkedIn via the owner's paid enrichment connectors
-- (Apollo / Clay / Common Room), fit-score each match against the owner's ICP, write a 3-line brief,
-- draft three voice-checked pieces of outreach (connection note ≤300 chars, day-3 InMail, day-7
-- follow-up), and stage each send as its own Approval Queue card. Nothing auto-sends; the actual
-- click rides the owner's own logged-in browser at human rate (§3 TOS handling).
--
-- Additive only: three new tables + one widened CHECK on pa_inbox_items. No destructive change.
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL / ref haizcnyywvewjygzeaaf).
-- RLS: owner reads their own rows; every write rides the service role from gated product routes,
-- matching the pa_lead_scout_* / pa_rituals pattern (service-role bypasses RLS — no GRANT needed).

-- ── Runs: one row per LinkedIn search the owner fires ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_linkedin_scout_runs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The structured ICP filters + free-text fallback the search ran with (SPEC §4.1).
  search_params    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- How many candidates the enrichment dispatcher returned, and how many the owner shortlisted.
  candidate_count  INTEGER     NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  shortlist_count  INTEGER     NOT NULL DEFAULT 0 CHECK (shortlist_count >= 0),
  -- Realized USD for the run's metered LLM work (fit-score + brief + drafts). Enrichment API cost is
  -- on the owner's own connector bill (SPEC §7) and is NOT captured here.
  cost_usd         NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_li_scout_runs_owner
  ON pa_linkedin_scout_runs (owner_id, created_at DESC);

-- ── Prospects: one row per candidate the owner shortlists ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_linkedin_scout_prospects (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                 UUID        NOT NULL REFERENCES pa_linkedin_scout_runs(id) ON DELETE CASCADE,
  owner_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_profile_url   TEXT        NOT NULL,
  full_name              TEXT        NOT NULL DEFAULT '',
  headline               TEXT        NOT NULL DEFAULT '',
  company                TEXT        NOT NULL DEFAULT '',
  fit_score              INTEGER     NOT NULL DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
  enrichment_source      TEXT        NOT NULL
                                       CHECK (enrichment_source IN ('apollo','clay','common_room','sales_nav')),
  enrichment_snapshot    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  brief                  TEXT        NOT NULL DEFAULT '',
  connection_status      TEXT        NOT NULL DEFAULT 'pending'
                                       CHECK (connection_status IN ('pending','sent','accepted','declined','expired')),
  connection_sent_at     TIMESTAMPTZ,
  connection_accepted_at TIMESTAMPTZ,
  day3_inmail_status     TEXT        NOT NULL DEFAULT 'pending',
  day7_followup_status   TEXT        NOT NULL DEFAULT 'pending',
  metadata               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One prospect per LinkedIn profile per owner — re-shortlisting the same person is idempotent, and the
-- rolling-7d gate (lib/linkedin-scout/gate.ts) counts distinct prospects, never duplicates. A profile
-- URL can recur across two different owners, so the uniqueness is scoped to (owner_id, url).
CREATE UNIQUE INDEX IF NOT EXISTS uq_pa_li_scout_prospect_owner_url
  ON pa_linkedin_scout_prospects (owner_id, linkedin_profile_url);

CREATE INDEX IF NOT EXISTS idx_pa_li_scout_prospects_owner_status
  ON pa_linkedin_scout_prospects (owner_id, connection_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pa_li_scout_prospects_run
  ON pa_linkedin_scout_prospects (run_id);

-- ── Drafts: one row per queued piece of outreach (connection note / day-3 InMail / day-7 follow-up) ─
CREATE TABLE IF NOT EXISTS pa_linkedin_scout_drafts (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id             UUID        NOT NULL REFERENCES pa_linkedin_scout_prospects(id) ON DELETE CASCADE,
  owner_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind                    TEXT        NOT NULL
                                        CHECK (kind IN ('connection_note','day3_inmail','day7_followup')),
  body                    TEXT        NOT NULL DEFAULT '',
  -- The voice-scan verdict carried on the card ('' = clean; else a short reason the two-strike retry
  -- couldn't clear, surfaced as a voice_warning on the Approval Queue card — SPEC §11).
  voice_flags             TEXT        NOT NULL DEFAULT '',
  -- The Approval Queue card this draft owns. Points at pa_inbox_items (the SHIPPED "/agent" Approval
  -- Queue) — the SPEC calls it pa_pending_actions; in this codebase that surface is pa_inbox_items,
  -- staged with kind='linkedin_scout_send'. Every draft has exactly one card.
  agent_pending_action_id UUID        REFERENCES pa_inbox_items(id) ON DELETE SET NULL,
  executed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One card per (prospect, kind): re-drafting replaces the row rather than stacking cards.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pa_li_scout_draft_prospect_kind
  ON pa_linkedin_scout_drafts (prospect_id, kind);
CREATE INDEX IF NOT EXISTS idx_pa_li_scout_drafts_owner
  ON pa_linkedin_scout_drafts (owner_id, created_at DESC);

-- ── RLS: owner-scoped reads; service-role writes from product routes ──────────────────────────────
ALTER TABLE pa_linkedin_scout_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_linkedin_scout_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_linkedin_scout_drafts    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_li_scout_runs_owner_select ON pa_linkedin_scout_runs;
CREATE POLICY pa_li_scout_runs_owner_select
  ON pa_linkedin_scout_runs FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS pa_li_scout_prospects_owner_select ON pa_linkedin_scout_prospects;
CREATE POLICY pa_li_scout_prospects_owner_select
  ON pa_linkedin_scout_prospects FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS pa_li_scout_drafts_owner_select ON pa_linkedin_scout_drafts;
CREATE POLICY pa_li_scout_drafts_owner_select
  ON pa_linkedin_scout_drafts FOR SELECT USING (owner_id = auth.uid());

-- ── Widen the Inbox kind CHECK for the LinkedIn Scout send card ───────────────────────────────────
-- Additive: rebuild from the FULL InboxKind union (matching migration 072's pattern — never drop a
-- live kind) and add 'linkedin_scout_send'. Each queued draft stages as one such card.
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
    'agent_builder_proposal',
    'signal_catcher_ritual_proposal',
    'linkedin_scout_send'
  ));
