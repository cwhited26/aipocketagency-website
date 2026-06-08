-- PA Mission Control — heartbeat / retry telemetry, zombie + verifying run statuses, needs-human
-- terminal flag, and an advisory verification log (decisions PA-MC-1..PA-MC-9).
--
-- Additive only. Widens the pa_sub_agent_runs status CHECK (adds 'verifying' + 'zombie'),
-- adds five nullable telemetry columns, and creates pa_verification_log. Never drops data.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL) via Supabase MCP. Safe to apply
-- early — Wave B still ships behind PA_ORCHESTRATOR_ENABLED; these columns/table sit unused
-- until the Watchdog cron and verification gate run. Builds on migration 021 (orchestrator).

-- ── 1. pa_sub_agent_runs: admit the Mission Control run statuses ───────────────────────────
-- 021 created the CHECK with ('planning','running','paused','done','failed','canceled').
-- 'verifying' = a completed run undergoing the second-opinion gate. 'zombie' = the Watchdog
-- found no heartbeat for >60s and reclaimed it. Neither is terminal (a late completion can
-- still reconcile a zombie), so the active-run sweep index excludes them deliberately.
ALTER TABLE pa_sub_agent_runs DROP CONSTRAINT IF EXISTS pa_sub_agent_runs_status_check;
ALTER TABLE pa_sub_agent_runs
  ADD CONSTRAINT pa_sub_agent_runs_status_check
  CHECK (status IN ('planning', 'running', 'paused', 'verifying', 'zombie', 'done', 'failed', 'canceled'));

-- ── 2. pa_sub_agent_runs: heartbeat + retry + verification telemetry ───────────────────────
-- All nullable so the migration is harmless to apply against existing rows. last_heartbeat_at
-- is stamped by the runtime webhook on every event; the Watchdog compares it to now() - 60s.
-- retries_used / retry_budget surface the run's retry headroom on the Active card. needs_human
-- flips true when a run zombies out or fails the verification gate 2+ times — it parks the run
-- in the Attention section with an amber accent.
ALTER TABLE pa_sub_agent_runs
  ADD COLUMN IF NOT EXISTS last_heartbeat_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retries_used         INTEGER,
  ADD COLUMN IF NOT EXISTS retry_budget         INTEGER,
  ADD COLUMN IF NOT EXISTS verification_verdict TEXT
    CHECK (verification_verdict IS NULL OR verification_verdict IN ('pass', 'fail', 'abstain')),
  ADD COLUMN IF NOT EXISTS needs_human          BOOLEAN NOT NULL DEFAULT false;

-- Watchdog sweep: find live runs whose heartbeat went stale. Partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS idx_pa_sub_agent_runs_heartbeat
  ON pa_sub_agent_runs (last_heartbeat_at)
  WHERE status IN ('planning', 'running', 'paused', 'verifying');

-- Attention lookups (needs_human runs surface first regardless of status).
CREATE INDEX IF NOT EXISTS idx_pa_sub_agent_runs_needs_human
  ON pa_sub_agent_runs (business_id, updated_at DESC)
  WHERE needs_human = true;

-- ── 3. pa_verification_log ─────────────────────────────────────────────────────────────────
-- One row per second-opinion pass over a completed run (PA-MC-7). v1 is ADVISORY: the verdict
-- is logged and surfaced but never blocks completion. v2 (future) enforces. verdict mirrors the
-- run column CHECK. reason is the human-readable why.
CREATE TABLE IF NOT EXISTS pa_verification_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_agent_run_id UUID        NOT NULL REFERENCES pa_sub_agent_runs(id) ON DELETE CASCADE,
  verdict          TEXT        NOT NULL CHECK (verdict IN ('pass', 'fail', 'abstain')),
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_verification_log_run
  ON pa_verification_log (sub_agent_run_id, created_at DESC);

ALTER TABLE pa_verification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_verification_log_select_own" ON pa_verification_log;
CREATE POLICY "pa_verification_log_select_own" ON pa_verification_log
  FOR SELECT USING (
    sub_agent_run_id IN (SELECT id FROM pa_sub_agent_runs WHERE business_id = auth.uid())
  );
