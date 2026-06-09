-- 057_cost_budget_gate.sql — Cost Observability Phases 3 + 4 (PA-COST-12..14, SPEC §5.3/§5.4/§5.6).
-- (Numbered 057: 053 = cost ledger + budgets table, 054 = RAG indexes, 055 = RAG zone cursor,
--  056 = cost micro-cents. The pa_cost_budgets TABLE itself already shipped in 053 with tier-default
--  seeding — Phase 3 is the Settings write/supersede path + UI on top of it, so this migration adds
--  only what Phase 4's gate needs.)
--
-- Two additive, non-destructive changes:
--
--   1. pa_cost_budget_decisions — the owner's per-PERIOD soft-pause choice (PA-COST-13). When the
--      dispatcher pauses at 80% it asks "keep going / pause new agent runs for the month / raise the
--      cap"; the choice persists for the rest of the calendar month so the warn doesn't re-prompt
--      every turn. One row per (owner, period_start). 'keep_going' suppresses further 80% warns but
--      still gates at 100%; 'pause' gates every new sub-agent dispatch for the remainder of the period.
--
--   2. pa_inbox_items.kind CHECK widened to admit 'cost_budget_gate' — the Mission Control card the
--      dispatcher stages at >=100% instead of firing a new sub-agent run (PA-COST-14).
--
-- RLS: owner-reads-own on the decisions table. Service role (the dispatcher holds the service key) writes.

-- ── 1. pa_cost_budget_decisions (SPEC §5.4 — the per-period soft-pause choice) ──────────────────────
CREATE TABLE IF NOT EXISTS pa_cost_budget_decisions (
  owner_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The first calendar day of the budget period (UTC month start) this choice applies to. A new month
  -- has no row, so the gate re-prompts once per period — exactly the cadence an SMB owner reconciles on.
  period_start date NOT NULL,
  -- keep_going = acknowledged, don't warn again this period (still gates at 100%).
  -- pause       = owner paused new agent runs for the period (gates every new dispatch until next period).
  decision     text NOT NULL CHECK (decision IN ('keep_going', 'pause')),
  decided_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, period_start)
);

ALTER TABLE pa_cost_budget_decisions ENABLE ROW LEVEL SECURITY;

-- Owner reads their own decision. Writes (the dispatcher + the /api/app/budget/decision route) go
-- through the service role, which bypasses RLS; the absence of write policies keeps every other role read-only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pa_cost_budget_decisions' AND policyname = 'pa_cost_budget_decisions_owner_read'
  ) THEN
    CREATE POLICY pa_cost_budget_decisions_owner_read ON pa_cost_budget_decisions
      FOR SELECT USING (owner_id = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE pa_cost_budget_decisions IS
  'Per-owner per-period soft-pause choice (PA-COST-13). keep_going suppresses 80% warns; pause gates new dispatches for the period. One row per (owner, period_start).';

-- ── 2. pa_inbox_items: admit the cost-budget gate card (PA-COST-14, SPEC §5.4/§8) ───────────────────
-- 048 (the last lane to touch this CHECK) set the full kind list; we re-state it + add cost_budget_gate.
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
    'cost_budget_gate'
  ));
