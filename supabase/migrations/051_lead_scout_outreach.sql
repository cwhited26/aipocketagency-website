-- 051_lead_scout_outreach.sql — Lead Scout Phase 3 (the outreach loop + scheduled re-runs).
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL — project haizcnyywvewjygzeaaf).
-- Apply AFTER 044_lead_scout.sql + 047_lead_scout_google_maps.sql.
--
-- Additive only. Two changes, neither drops data:
--   1. pa_lead_scout_leads gains `outreach_drafted_at` (nullable timestamptz). Null until the Email
--      Drafter has staged an outreach draft for the lead; set on stage so the batch generator is
--      idempotent per lead (re-running "Draft outreach" never double-drafts the same lead).
--   2. pa_lead_scout_sources gains `last_run_at` + `next_run_at` (nullable timestamptz). These drive
--      the scheduled re-runs cron (/api/cron/lead-scout): a source whose schedule is 'daily' or
--      'weekly' carries a next_run_at; the cron sweeps every source whose next_run_at is due, runs
--      the scrape, auto-stages outreach for the hot + warm leads, and advances next_run_at. An
--      'on_demand' source leaves both null and is never picked up by the cron.
--
-- No new tables, no new inbox kind: the outreach drafts reuse the shipped 'draft' inbox kind
-- (source='email-drafter'), so Approve & Send routes through the existing Gmail send path; the
-- scheduled scrape reuses the 'lead_scout_batch' card (044).

-- ── 1 · per-lead outreach stamp (idempotency) ────────────────────────────────────────────────────
ALTER TABLE pa_lead_scout_leads
  ADD COLUMN IF NOT EXISTS outreach_drafted_at TIMESTAMPTZ;

-- Partial index: the batch generator filters to leads that haven't been drafted yet.
CREATE INDEX IF NOT EXISTS idx_lead_scout_leads_outreach_pending
  ON pa_lead_scout_leads (run_id)
  WHERE outreach_drafted_at IS NULL;

-- ── 2 · source scheduling cursors ────────────────────────────────────────────────────────────────
ALTER TABLE pa_lead_scout_sources
  ADD COLUMN IF NOT EXISTS last_run_at  TIMESTAMPTZ;
ALTER TABLE pa_lead_scout_sources
  ADD COLUMN IF NOT EXISTS next_run_at  TIMESTAMPTZ;

-- The cron scans for due scheduled sources: next_run_at <= now() with a non-on_demand schedule.
CREATE INDEX IF NOT EXISTS idx_lead_scout_sources_due
  ON pa_lead_scout_sources (next_run_at)
  WHERE next_run_at IS NOT NULL;
