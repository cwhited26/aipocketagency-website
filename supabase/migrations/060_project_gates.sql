-- 060_project_gates.sql — PA Projects v1.1 Gate Phase (SPEC v1.1, PA-GATE-1..9).
-- Additive migration — creates the two gate tables, widens the inbox kind CHECK with
-- 'gate_findings', and adds the atomic per-gate trust-window RPC. Never drops data.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL) via Supabase MCP after the lane
-- lands. The Gate Phase ships dark behind PA_PROJECT_GATES_ENABLED (default off) — the schema is
-- harmless to apply early; the dispatcher fires leaf tasks exactly as before until the flag is
-- set AND Wave B's first real Project dispatch has landed (PA-GATE-1, same bridge-before-the-boat
-- discipline as 021_orchestrator).
--
-- Scoping model: PA is one-business-per-user. business_id / user_id is the owner's auth user id
-- (= pocket_agent_users.id = auth.users.id). RLS lets an owner read their own rows; every WRITE
-- goes through the service-role key in server routes (bypasses RLS) scoped by business_id/user_id
-- in the query — mirroring 021_orchestrator and lib/orchestrator/gates/db.ts.

-- ── 1. pa_gate_findings ─────────────────────────────────────────────────────────────────
-- One row per (gate, plan_version) of a gated Project plan. The seven specialist gates each
-- write exactly one row here per run (their ONLY write — ContainmentGuard, SPEC §7). The
-- finding jsonb is structured (rule_violated + rule_source + plan_task_violating + severity +
-- suggested_fix + evidence, PA-GATE-7); it is null only when status='pass'. status='error'
-- rows carry the fail-closed reason in finding.evidence (timeout / malformed / rulefile-unreadable).
CREATE TABLE IF NOT EXISTS pa_gate_findings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The Project / scaffolding this plan belongs to. Wave B keys a Project to its sub-agent run,
  -- so project_id = pa_sub_agent_runs.id; SET NULL keeps findings auditable if the run is purged.
  project_id      UUID        REFERENCES pa_sub_agent_runs(id) ON DELETE SET NULL,
  plan_version    INTEGER     NOT NULL DEFAULT 1,
  gate_name       TEXT        NOT NULL
                    CHECK (gate_name IN (
                      'voice', 'customer_name', 'decision', 'code_convention',
                      'security', 'test', 'connector_cost'
                    )),
  status          TEXT        NOT NULL
                    CHECK (status IN ('pass', 'flag', 'hard_fail', 'error')),
  finding         JSONB,
  time_budget_ms  INTEGER     NOT NULL DEFAULT 60000,
  actual_ms       INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_gate_findings_project
  ON pa_gate_findings (project_id, plan_version, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pa_gate_findings_business
  ON pa_gate_findings (business_id, created_at DESC);

ALTER TABLE pa_gate_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_gate_findings_select_own" ON pa_gate_findings;
CREATE POLICY "pa_gate_findings_select_own" ON pa_gate_findings
  FOR SELECT USING (business_id = auth.uid());

-- ── 2. pa_gate_overrides ────────────────────────────────────────────────────────────────
-- Per (owner, gate): the Trust-Ladder state (PA-GATE-5). enabled toggles whether the gate runs
-- (default true — no wholesale opt-out of the phase, but a single gate may be skipped, logged via
-- last_toggled_at). clean_pass_count is the running streak of clean passes of THIS gate, atomically
-- incremented on a clean pass and reset to 0 on any flag/hard_fail (the trust-window-gaming defense,
-- SPEC §12). auto_dismiss_enabled is the owner's per-gate Approve-anyway toggle; the app gates it
-- server-side on clean_pass_count >= auto_dismiss_threshold (default 10, mirrors APA-ORCH-25).
CREATE TABLE IF NOT EXISTS pa_gate_overrides (
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gate_name             TEXT        NOT NULL
                          CHECK (gate_name IN (
                            'voice', 'customer_name', 'decision', 'code_convention',
                            'security', 'test', 'connector_cost'
                          )),
  enabled               BOOLEAN     NOT NULL DEFAULT true,
  auto_dismiss_threshold INTEGER    NOT NULL DEFAULT 10,
  clean_pass_count      INTEGER     NOT NULL DEFAULT 0,
  auto_dismiss_enabled  BOOLEAN     NOT NULL DEFAULT false,
  last_toggled_at       TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, gate_name)
);

ALTER TABLE pa_gate_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_gate_overrides_select_own" ON pa_gate_overrides;
CREATE POLICY "pa_gate_overrides_select_own" ON pa_gate_overrides
  FOR SELECT USING (user_id = auth.uid());

-- ── 3. pa_inbox_items: admit the gate_findings kind ─────────────────────────────────────
-- CHECK history: 012 created ('draft','decision'); 014 'email_triage'; 016 'persona_lead';
-- 021 'action_approval'+'sub_agent_activity'; 023 'routine_output'; 044 'lead_scout_batch';
-- 046 'build_action_approval'. A flagged/blocked plan stages one 'gate_findings' card pointing at
-- the Project + gated plan_version; its detail rows are the pa_gate_findings rows for that pair
-- (PA-GATE-9). Additive only — every existing kind is preserved.
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
    'gate_findings'
  ));

-- ── 4. Atomic per-gate trust-window bookkeeping (PA-GATE-5) ──────────────────────────────
-- Records one gate result against the owner's streak in a single round trip with a row lock, so
-- two concurrent Project dispatches can't both read-modify-write the same counter and corrupt the
-- window (the trust-window-gaming defense, SPEC §12). p_clean=true → +1; any flag/hard_fail →
-- reset to 0, which re-locks Approve-anyway the moment a single real flag lands. Returns the new
-- clean_pass_count. The row is created on first sight with the gate's threshold default.
CREATE OR REPLACE FUNCTION gate_record_result(
  p_user_id   UUID,
  p_gate_name TEXT,
  p_clean     BOOLEAN,
  p_threshold INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO pa_gate_overrides (user_id, gate_name, auto_dismiss_threshold, clean_pass_count)
  VALUES (p_user_id, p_gate_name, GREATEST(1, p_threshold), CASE WHEN p_clean THEN 1 ELSE 0 END)
  ON CONFLICT (user_id, gate_name)
  DO UPDATE SET
    clean_pass_count = CASE WHEN p_clean THEN pa_gate_overrides.clean_pass_count + 1 ELSE 0 END,
    updated_at       = now()
  RETURNING clean_pass_count INTO v_count;
  RETURN v_count;
END;
$$;
