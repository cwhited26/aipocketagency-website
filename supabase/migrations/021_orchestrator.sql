-- PA v5 Wave B — Dispatcher + Execution + Approval Inbox (SPEC v5 §6, §9.2–9.4, §11.3).
-- Additive migration — creates the six orchestrator tables, widens the inbox kind CHECK,
-- and adds the atomic agent-minute + trust-window RPCs. Never drops data.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL) via Supabase MCP after the
-- lane lands. Wave B ships behind the env flag PA_ORCHESTRATOR_ENABLED — the schema is
-- harmless to apply early; the dispatcher stays inert (chat send falls back to Wave A
-- behaviour) until the flag is set on Vercel AND a Modal runtime URL is configured.
--
-- Scoping model: PA is one-business-per-user. `business_id` / `user_id` is the owner's
-- auth user id (= pocket_agent_users.id = auth.users.id). RLS lets an owner read their own
-- rows; every WRITE goes through the service-role key in server routes (which bypasses RLS)
-- and is scoped by business_id/user_id in the query — mirroring lib/pa-supabase.ts,
-- lib/chat/db.ts, and lib/personas/db.ts.
--
-- Note: migration 020 (020_pocket_agent_tier.sql) is the pricing lane's tier column; this
-- orchestrator migration is intentionally numbered 021 to avoid colliding with it.

-- ── 1. pa_sub_agent_runs ──────────────────────────────────────────────────────────────
-- One row per dispatched sub-agent run. The originating chat message threads the run back
-- to "the message the owner typed that started this". spec_json is the auto-generated ISA
-- the sub-agent executes. phase_progress tracks the 7-phase Algorithm state.
CREATE TABLE IF NOT EXISTS pa_sub_agent_runs (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  originating_message_id UUID      REFERENCES pa_chat_messages(id) ON DELETE SET NULL,
  status               TEXT        NOT NULL DEFAULT 'planning'
                         CHECK (status IN ('planning', 'running', 'paused', 'done', 'failed', 'canceled')),
  spec_json            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  tool_scopes          TEXT[]      NOT NULL DEFAULT '{}',
  time_budget_seconds  INTEGER     NOT NULL DEFAULT 300,
  started_at           TIMESTAMPTZ,
  phase_progress       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  result_summary       TEXT,
  token_cost           INTEGER     NOT NULL DEFAULT 0,
  agent_minutes        NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_sub_agent_runs_business_created
  ON pa_sub_agent_runs (business_id, created_at DESC);

-- Active-run lookups (concurrency cap + the cron timeout sweep).
CREATE INDEX IF NOT EXISTS idx_pa_sub_agent_runs_active
  ON pa_sub_agent_runs (status, started_at)
  WHERE status IN ('planning', 'running', 'paused');

CREATE INDEX IF NOT EXISTS idx_pa_sub_agent_runs_message
  ON pa_sub_agent_runs (originating_message_id)
  WHERE originating_message_id IS NOT NULL;

ALTER TABLE pa_sub_agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_sub_agent_runs_select_own" ON pa_sub_agent_runs;
CREATE POLICY "pa_sub_agent_runs_select_own" ON pa_sub_agent_runs
  FOR SELECT USING (business_id = auth.uid());

-- ── 2. pa_sub_agent_phase_log ─────────────────────────────────────────────────────────
-- Append-only phase-transition log for a run. One row each time a run enters a phase of
-- the 7-phase Algorithm. duration_ms is filled in when the phase completes.
CREATE TABLE IF NOT EXISTS pa_sub_agent_phase_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      UUID        NOT NULL REFERENCES pa_sub_agent_runs(id) ON DELETE CASCADE,
  phase       TEXT        NOT NULL
                CHECK (phase IN ('observe', 'think', 'plan', 'build', 'execute', 'verify', 'learn')),
  entered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INTEGER,
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_pa_sub_agent_phase_log_run
  ON pa_sub_agent_phase_log (run_id, entered_at);

ALTER TABLE pa_sub_agent_phase_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_sub_agent_phase_log_select_own" ON pa_sub_agent_phase_log;
CREATE POLICY "pa_sub_agent_phase_log_select_own" ON pa_sub_agent_phase_log
  FOR SELECT USING (
    run_id IN (SELECT id FROM pa_sub_agent_runs WHERE business_id = auth.uid())
  );

-- ── 3. pa_connector_action_log ────────────────────────────────────────────────────────
-- Audit trail: every external write a sub-agent attempts. payload_hash lets the owner scrub
-- the timeline without the raw payload (which lives transiently on the approval row).
CREATE TABLE IF NOT EXISTS pa_connector_action_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sub_agent_run_id  UUID        REFERENCES pa_sub_agent_runs(id) ON DELETE SET NULL,
  connector         TEXT        NOT NULL,
  action            TEXT        NOT NULL,
  payload_hash      TEXT        NOT NULL DEFAULT '',
  status            TEXT        NOT NULL DEFAULT 'staged'
                      CHECK (status IN ('staged', 'approved', 'rejected', 'executed', 'failed')),
  response_summary  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_connector_action_log_business
  ON pa_connector_action_log (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pa_connector_action_log_run
  ON pa_connector_action_log (sub_agent_run_id)
  WHERE sub_agent_run_id IS NOT NULL;

ALTER TABLE pa_connector_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_connector_action_log_select_own" ON pa_connector_action_log;
CREATE POLICY "pa_connector_action_log_select_own" ON pa_connector_action_log
  FOR SELECT USING (business_id = auth.uid());

-- ── 4. pa_action_approvals ────────────────────────────────────────────────────────────
-- Extends pa_inbox_items (SPEC v5 §11.3): an action staged for one-tap approval. The Inbox
-- row (kind='action_approval') drives the queue + badge; this companion row holds the
-- action-specific detail (connector, action, payload, originating run). One approval per
-- inbox item.
CREATE TABLE IF NOT EXISTS pa_action_approvals (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_item_id        UUID        NOT NULL UNIQUE REFERENCES pa_inbox_items(id) ON DELETE CASCADE,
  business_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sub_agent_run_id     UUID        REFERENCES pa_sub_agent_runs(id) ON DELETE SET NULL,
  connector            TEXT        NOT NULL,
  action               TEXT        NOT NULL,
  payload              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  auto_approve_eligible BOOLEAN    NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_action_approvals_business
  ON pa_action_approvals (business_id, created_at DESC);

ALTER TABLE pa_action_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_action_approvals_select_own" ON pa_action_approvals;
CREATE POLICY "pa_action_approvals_select_own" ON pa_action_approvals
  FOR SELECT USING (business_id = auth.uid());

-- ── 5. pa_auto_approve_settings ───────────────────────────────────────────────────────
-- Per (user, connector, action): the trust-ladder toggle (PA-ORCH-4). `enabled` only flips
-- on once `success_count` clears the trust window; the app gates the toggle UI on that count.
CREATE TABLE IF NOT EXISTS pa_auto_approve_settings (
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector        TEXT        NOT NULL,
  action           TEXT        NOT NULL,
  enabled          BOOLEAN     NOT NULL DEFAULT false,
  success_count    INTEGER     NOT NULL DEFAULT 0,
  last_toggled_at  TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, connector, action)
);

ALTER TABLE pa_auto_approve_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_auto_approve_settings_select_own" ON pa_auto_approve_settings;
CREATE POLICY "pa_auto_approve_settings_select_own" ON pa_auto_approve_settings
  FOR SELECT USING (user_id = auth.uid());

-- ── 6. pa_orchestrator_usage_monthly ──────────────────────────────────────────────────
-- Per (business, month yyyy-mm): the agent-minute meter the tier cap enforces against
-- (PA-ORCH-5). agent_minutes_used is reserved up-front at dispatch (race-free via the RPC
-- below) then reconciled to actuals when the run finishes.
CREATE TABLE IF NOT EXISTS pa_orchestrator_usage_monthly (
  business_id        UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month              TEXT          NOT NULL,
  agent_minutes_used NUMERIC(12,3) NOT NULL DEFAULT 0,
  total_cost         NUMERIC(12,4) NOT NULL DEFAULT 0,
  run_count          INTEGER       NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),

  PRIMARY KEY (business_id, month)
);

ALTER TABLE pa_orchestrator_usage_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_orchestrator_usage_monthly_select_own" ON pa_orchestrator_usage_monthly;
CREATE POLICY "pa_orchestrator_usage_monthly_select_own" ON pa_orchestrator_usage_monthly
  FOR SELECT USING (business_id = auth.uid());

-- ── 7. pa_inbox_items: admit the orchestrator kinds ───────────────────────────────────
-- 012 created the CHECK with ('draft','decision'); 014 added 'email_triage'; 016 added
-- 'persona_lead'. Wave B stages external write-actions as 'action_approval' and sub-agent
-- progress can surface as 'sub_agent_activity'.
ALTER TABLE pa_inbox_items DROP CONSTRAINT IF EXISTS pa_inbox_items_kind_check;
ALTER TABLE pa_inbox_items
  ADD CONSTRAINT pa_inbox_items_kind_check
  CHECK (kind IN ('draft', 'decision', 'email_triage', 'persona_lead', 'action_approval', 'sub_agent_activity'));

-- ── 8. Atomic agent-minute reservation (PA-ORCH-5) ────────────────────────────────────
-- Reserves p_minutes against the month's meter in one round trip with a row lock, so two
-- concurrent dispatches can't both squeak past the cap (defeats the §8 tier-cap-bypass
-- adversarial test). p_cap NULL = unlimited (Enterprise). Returns TRUE iff reserved.
CREATE OR REPLACE FUNCTION orchestrator_reserve_agent_minutes(
  p_business_id UUID,
  p_month       TEXT,
  p_minutes     NUMERIC,
  p_cap         NUMERIC
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_used NUMERIC;
BEGIN
  INSERT INTO pa_orchestrator_usage_monthly (business_id, month, agent_minutes_used)
  VALUES (p_business_id, p_month, 0)
  ON CONFLICT (business_id, month) DO NOTHING;

  SELECT agent_minutes_used INTO v_used
  FROM pa_orchestrator_usage_monthly
  WHERE business_id = p_business_id AND month = p_month
  FOR UPDATE;

  IF p_cap IS NOT NULL AND (v_used + p_minutes) > p_cap THEN
    RETURN FALSE;
  END IF;

  UPDATE pa_orchestrator_usage_monthly
  SET agent_minutes_used = agent_minutes_used + p_minutes,
      run_count          = run_count + 1,
      updated_at         = now()
  WHERE business_id = p_business_id AND month = p_month;

  RETURN TRUE;
END;
$$;

-- Reconciles a finished run: swap the reserved estimate for the measured actual and add the
-- run's cost. Never lets the meter go negative. Called from the webhook + the timeout sweep.
CREATE OR REPLACE FUNCTION orchestrator_reconcile_agent_minutes(
  p_business_id    UUID,
  p_month          TEXT,
  p_reserved       NUMERIC,
  p_actual         NUMERIC,
  p_cost           NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE pa_orchestrator_usage_monthly
  SET agent_minutes_used = GREATEST(0, agent_minutes_used - p_reserved + p_actual),
      total_cost         = total_cost + COALESCE(p_cost, 0),
      updated_at         = now()
  WHERE business_id = p_business_id AND month = p_month;
END;
$$;

-- Records one successful approval of an (action type) and returns the new running count, so
-- the app can unlock the auto-approve toggle once the trust window is cleared (PA-ORCH-4).
CREATE OR REPLACE FUNCTION orchestrator_record_auto_approve_success(
  p_user_id   UUID,
  p_connector TEXT,
  p_action    TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO pa_auto_approve_settings (user_id, connector, action, success_count)
  VALUES (p_user_id, p_connector, p_action, 1)
  ON CONFLICT (user_id, connector, action)
  DO UPDATE SET success_count = pa_auto_approve_settings.success_count + 1,
               updated_at     = now()
  RETURNING success_count INTO v_count;
  RETURN v_count;
END;
$$;
