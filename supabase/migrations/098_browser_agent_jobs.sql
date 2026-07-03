-- 098_browser_agent_jobs.sql — Browser Agent App (PA-POS-19): long-running hosted-browser jobs
-- driven by Anthropic Computer Use against Browserbase sessions, advanced by the
-- /api/cron/browser-worker tick. Additive only.
--
-- Distinct from 093 (pa_browser_actions / pa_browser_domain_permissions — the Playwright
-- tool-call primitive). A job here is a multi-step mission ("reorder the supplies on this
-- portal"), not a single tool call.
--
-- Manual step alongside this migration: create the private Storage bucket
-- `pa-browser-screenshots` (owner-scoped paths <owner_id>/<job_id>/<step>.png; objects are
-- served to the owner via short-lived signed URLs minted by service-role routes).

-- ── pa_browser_jobs — one row per browser mission ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_browser_jobs (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Reserved for the org/workspace split; PA today is single-workspace per owner.
  workspace_id             UUID,
  agent_persona_id         UUID,
  intent                   TEXT        NOT NULL,
  starting_url             TEXT        NOT NULL,
  status                   TEXT        NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'awaiting_approval', 'completed', 'failed', 'canceled')),
  current_step             INT         NOT NULL DEFAULT 0,
  max_steps                INT         NOT NULL DEFAULT 50,
  max_wall_seconds         INT         NOT NULL DEFAULT 1800,
  -- Cost ledger convention (migration 056): micro-cents, 1 USD = 1,000,000 micro-cents.
  -- Default cap 5,000,000 = $5.00 per job.
  max_cost_micro_cents     BIGINT      NOT NULL DEFAULT 5000000,
  cost_micro_cents_estimate BIGINT     NOT NULL DEFAULT 0,
  -- The Computer Use conversation + Browserbase session handle between cron ticks.
  state_json               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  browserbase_session_id   TEXT,
  -- The staged step waiting on the owner: { stepNumber, inboxItemId, action, reasoning }.
  pending_step             JSONB,
  -- Gate Phase findings recorded at creation (kept on the job — pa_gate_findings FKs to
  -- pa_sub_agent_runs, which a browser job is not).
  gate_findings            JSONB,
  result_summary           TEXT,
  error                    TEXT,
  -- Worker lease: a tick claims a job by advancing lease_until; overlapping crons skip
  -- leased rows so two ticks never drive the same browser session.
  lease_until              TIMESTAMPTZ,
  started_at               TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_browser_jobs_owner_idx
  ON pa_browser_jobs (owner_id, created_at DESC);

-- The worker's claim scan: only live jobs, oldest-touched first.
CREATE INDEX IF NOT EXISTS pa_browser_jobs_live_idx
  ON pa_browser_jobs (updated_at ASC)
  WHERE status IN ('queued', 'running', 'awaiting_approval');

-- ── pa_browser_steps — the step timeline (one row per executed or held action) ──────────
CREATE TABLE IF NOT EXISTS pa_browser_steps (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID        NOT NULL REFERENCES pa_browser_jobs(id) ON DELETE CASCADE,
  -- Denormalized for RLS (SELECT policy matches auth.uid() without a join).
  owner_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number     INT         NOT NULL,
  action_kind     TEXT        NOT NULL
    CHECK (action_kind IN ('click', 'type', 'key', 'screenshot', 'navigate', 'scroll', 'wait', 'awaiting_approval')),
  action_payload  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Storage object path in pa-browser-screenshots (<owner_id>/<job_id>/<step>.png);
  -- signed URLs are minted per render, never stored.
  screenshot_path TEXT,
  reasoning       TEXT,
  -- For action_kind='awaiting_approval': the Mission Control card + its resolution.
  inbox_item_id   UUID,
  approval_status TEXT
    CHECK (approval_status IS NULL OR approval_status IN ('pending', 'approved', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, step_number)
);

CREATE INDEX IF NOT EXISTS pa_browser_steps_job_idx
  ON pa_browser_steps (job_id, step_number ASC);
CREATE INDEX IF NOT EXISTS pa_browser_steps_owner_idx
  ON pa_browser_steps (owner_id, created_at DESC);

-- ── RLS: owner reads their own rows; every write rides the service role from gated routes ─
ALTER TABLE pa_browser_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_browser_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_browser_jobs_owner_select ON pa_browser_jobs;
CREATE POLICY pa_browser_jobs_owner_select
  ON pa_browser_jobs
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS pa_browser_steps_owner_select ON pa_browser_steps;
CREATE POLICY pa_browser_steps_owner_select
  ON pa_browser_steps
  FOR SELECT USING (owner_id = auth.uid());
