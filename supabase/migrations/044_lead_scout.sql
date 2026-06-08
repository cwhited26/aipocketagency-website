-- 044_lead_scout.sql — Lead Scout Phase 1 (the paste-a-URL-list flow).
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL — project haizcnyywvewjygzeaaf).
--
-- Additive only. Four changes, none of them drop data:
--   1. pa_connections.provider CHECK widened to admit 'lead_scout' (the Bright Data key connection).
--   2. pa_connections gains a `config` JSONB column — the Bright Data API key is stored AES-256-GCM
--      encrypted inside it ({ "api_key_encrypted": "v1.…", "use_shared": false }). Distinct from the
--      OAuth providers, which carry a refresh token; Lead Scout is a single pasted key, so it lives
--      in config rather than refresh_token_encrypted. Service-role writes only (same RLS as 013).
--   3. pa_inbox_items.kind CHECK widened to admit 'lead_scout_batch' — the Mission Control card a
--      finished run stages (source name + counts + classification breakdown + CSV link).
--   4. Three new tables: pa_lead_scout_sources, pa_lead_scout_runs, pa_lead_scout_leads.
--
-- The provider + inbox CHECKs are rewritten as the full superset (not an incremental edit) so this
-- file applies cleanly regardless of which sibling connector / inbox lanes have already landed.
-- Renumbered to 044 to clear the 035–043 concurrent lanes (mobile capture, project workspace,
-- slack DM, mission control, inbound email, sms, youtube).

-- ── 1 + 2 · pa_connections: admit lead_scout + add the config blob ───────────────────────────────
ALTER TABLE pa_connections DROP CONSTRAINT IF EXISTS pa_connections_provider_check;
ALTER TABLE pa_connections
  ADD CONSTRAINT pa_connections_provider_check
  CHECK (provider IN (
    'gmail', 'calendar', 'slack', 'quickbooks', 'stripe_connect', 'zoom', 'calendly', 'lead_scout'
  ));

ALTER TABLE pa_connections
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 3 · pa_inbox_items: admit the lead_scout_batch card kind ─────────────────────────────────────
-- CHECK history: 012 created ('draft','decision'); 014 added 'email_triage'; 016 added 'persona_lead';
-- 021 added 'action_approval' + 'sub_agent_activity'; 023 added 'routine_output'. Additive only.
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
    'lead_scout_batch'
  ));

-- ── 4 · Lead Sources ─────────────────────────────────────────────────────────────────────────────
-- A Lead Source is a saved scraping intent (PA-LS-3): a name, what to extract (the extraction
-- pattern, which also becomes the backing Project's Instructions), an optional seed URL list, and a
-- schedule. Each source is backed 1:1 by a Project (project_id) so its runs, references, and memory
-- live in the Project Workspace.
CREATE TABLE IF NOT EXISTS pa_lead_scout_sources (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id          UUID        REFERENCES pa_projects(id) ON DELETE SET NULL,
  name                TEXT        NOT NULL,
  kind                TEXT        NOT NULL DEFAULT 'url_list'
                        CHECK (kind IN ('url_list')),
  extraction_pattern  TEXT        NOT NULL,
  seed_urls           TEXT[]      NOT NULL DEFAULT '{}',
  schedule            TEXT        NOT NULL DEFAULT 'on_demand'
                        CHECK (schedule IN ('on_demand', 'daily', 'weekly')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_scout_sources_owner
  ON pa_lead_scout_sources (owner_id, updated_at DESC);

-- ── Runs ─────────────────────────────────────────────────────────────────────────────────────────
-- One scrape pass over a source's URLs. breakdown holds the classification tally
-- ({ hot, warm, cold, wrong_fit, needs_research }); config_warnings logs URLs that tripped the
-- denylist on this run (PA-LS-5) so a previously-OK URL that later trips it is surfaced, not silent.
CREATE TABLE IF NOT EXISTS pa_lead_scout_runs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id         UUID        NOT NULL REFERENCES pa_lead_scout_sources(id) ON DELETE CASCADE,
  owner_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT        NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  url_count         INTEGER     NOT NULL DEFAULT 0,
  lead_count        INTEGER     NOT NULL DEFAULT 0,
  breakdown         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  config_warnings   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  error             TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_scout_runs_source
  ON pa_lead_scout_runs (source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_scout_runs_owner
  ON pa_lead_scout_runs (owner_id, created_at DESC);

-- ── Leads ────────────────────────────────────────────────────────────────────────────────────────
-- One row per URL processed. profile holds the structured extraction (whatever the pattern asked
-- for, as JSON); classification is the Haiku bucket. brain_path points at the note written to the
-- brain repo. A URL that failed to fetch/extract still gets a row (status='failed', error set) so
-- nothing is dropped silently.
CREATE TABLE IF NOT EXISTS pa_lead_scout_leads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID        NOT NULL REFERENCES pa_lead_scout_runs(id) ON DELETE CASCADE,
  source_id       UUID        NOT NULL REFERENCES pa_lead_scout_sources(id) ON DELETE CASCADE,
  owner_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url             TEXT        NOT NULL,
  domain          TEXT        NOT NULL DEFAULT '',
  name            TEXT        NOT NULL DEFAULT '',
  contact         TEXT        NOT NULL DEFAULT '',
  summary         TEXT        NOT NULL DEFAULT '',
  profile         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  classification  TEXT        NOT NULL DEFAULT 'needs_research'
                    CHECK (classification IN ('hot', 'warm', 'cold', 'wrong_fit', 'needs_research')),
  brain_path      TEXT,
  status          TEXT        NOT NULL DEFAULT 'extracted'
                    CHECK (status IN ('extracted', 'failed')),
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_scout_leads_run
  ON pa_lead_scout_leads (run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lead_scout_leads_owner
  ON pa_lead_scout_leads (owner_id, created_at DESC);

-- ── RLS: owner reads own rows; writes are service-role only (matches 013_pa_connections.sql) ──────
ALTER TABLE pa_lead_scout_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_lead_scout_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_lead_scout_leads   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_scout_sources_select_own" ON pa_lead_scout_sources;
CREATE POLICY "lead_scout_sources_select_own"
  ON pa_lead_scout_sources FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "lead_scout_runs_select_own" ON pa_lead_scout_runs;
CREATE POLICY "lead_scout_runs_select_own"
  ON pa_lead_scout_runs FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "lead_scout_leads_select_own" ON pa_lead_scout_leads;
CREATE POLICY "lead_scout_leads_select_own"
  ON pa_lead_scout_leads FOR SELECT USING (auth.uid() = owner_id);
-- No INSERT/UPDATE/DELETE policies: the anon/authenticated role is denied by default; only the
-- service-role key (server routes + the scout orchestrator) mutates these tables.
