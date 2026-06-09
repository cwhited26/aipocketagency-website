-- 053_cost_observability.sql — Cost Observability + Budgets Phase 1 (PA-COST-1..8, SPEC §5.1/§5.3).
-- (Numbered 053: 044–052 were taken by concurrent lanes — Lead Scout, Project Workspace, the four
--  Build connectors, Podcast Ingest, Lead Scout outreach + packs.)
--
-- The data layer only — writes flow, no UI. Two additive, non-destructive tables:
--
--   1. pa_cost_events  — the append-only cost ledger (PA-COST-2). One row per metered API call, written
--      the moment the cost is realized (after the provider returns its usage payload). Owner reads own
--      rows; service role writes; NO update/delete policy (append-only). A unique partial index on the
--      idempotency key collapses a retried realized cost to one row (PA-COST adversarial §9).
--
--   2. pa_cost_budgets — one ACTIVE monthly budget per owner (PA-COST-3), supersede-chain pattern. This
--      phase seeds tier-default budgets for existing owners; the Settings UI to edit lands in Phase 3.
--
-- RLS: owner-reads-own on both. Service role (the headless metered surfaces hold the service key) writes.

-- ── pa_cost_events (SPEC §5.1) ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_cost_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- podcast | youtube | lead_scout | roundtable | chat | email_drafter | build_tools
  feature_slug    text NOT NULL,
  -- anthropic | openai | bright_data | modal | twilio | resend
  backend         text NOT NULL,
  -- e.g. claude-sonnet-4-6 | whisper-1 | NULL for backend-only (flat-rate) events
  model           text,
  -- realized cost in cents (the price table rounds sub-cent calls on write)
  unit_cost_cents integer NOT NULL,
  -- NULL for non-LLM events
  tokens_input    integer,
  tokens_output   integer,
  -- { idempotency_key, sub_agent_run_id, conversation_id, ... }
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_cost_events_owner_created
  ON pa_cost_events (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pa_cost_events_owner_feature_created
  ON pa_cost_events (owner_id, feature_slug, created_at DESC);
-- Idempotency: one realized cost = one row, regardless of retries (PA-COST §9). Partial so events
-- without a key (there shouldn't be, but defensively) never collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_cost_events_idem
  ON pa_cost_events ((metadata->>'idempotency_key'))
  WHERE metadata->>'idempotency_key' IS NOT NULL;

ALTER TABLE pa_cost_events ENABLE ROW LEVEL SECURITY;

-- Owner reads their own rows only. NO insert/update/delete policy: the service role bypasses RLS to
-- write, and the absence of update/delete policies makes the ledger append-only for every other role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pa_cost_events' AND policyname = 'pa_cost_events_owner_read'
  ) THEN
    CREATE POLICY pa_cost_events_owner_read ON pa_cost_events
      FOR SELECT USING (owner_id = auth.uid());
  END IF;
END $$;

-- ── pa_cost_budgets (SPEC §5.3) ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_cost_budgets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- v1 = monthly only
  period          text NOT NULL DEFAULT 'monthly',
  budget_cents    integer NOT NULL,
  -- active | superseded | paused
  status          text NOT NULL DEFAULT 'active',
  effective_from  timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  superseded_by   uuid REFERENCES pa_cost_budgets(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- One active budget row per owner (the supersede chain keeps history; only one row is live).
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_cost_budgets_owner_active
  ON pa_cost_budgets (owner_id) WHERE status = 'active';

ALTER TABLE pa_cost_budgets ENABLE ROW LEVEL SECURITY;

-- Owner reads their own budget. Writes (seed here, Settings edits in Phase 3) go through the service role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pa_cost_budgets' AND policyname = 'pa_cost_budgets_owner_read'
  ) THEN
    CREATE POLICY pa_cost_budgets_owner_read ON pa_cost_budgets
      FOR SELECT USING (owner_id = auth.uid());
  END IF;
END $$;

-- ── Seed tier-default budgets for existing owners (PA-COST-3) ──────────────────────────────────────
-- Defaults: Free/Starter $0 · Pro $25 · Pro+ $50 (interpolated — the SPEC names 5 tiers, the ladder
-- has 6; Pro+ sits between Pro $25 and Studio $100) · Studio $100 · Studio+ $400 · Enterprise $2000.
-- Effective tier mirrors lib/personas/tier-caps#getCurrentTier: the subscription's stamped tier when
-- valid, else 'pro' for an active/trialing subscription, else 'starter'. Idempotent — the WHERE NOT
-- EXISTS + the active-budget unique index skip any owner who already has a live budget row.
INSERT INTO pa_cost_budgets (owner_id, period, budget_cents, status)
SELECT
  u.id,
  'monthly',
  CASE sub.eff_tier
    WHEN 'pro'         THEN 2500
    WHEN 'pro_plus'    THEN 5000
    WHEN 'studio'      THEN 10000
    WHEN 'studio_plus' THEN 40000
    WHEN 'enterprise'  THEN 200000
    ELSE 0
  END,
  'active'
FROM pocket_agent_users u
LEFT JOIN LATERAL (
  SELECT CASE
    WHEN s.tier IN ('starter', 'pro', 'pro_plus', 'studio', 'studio_plus', 'enterprise') THEN s.tier
    WHEN s.status IN ('active', 'trialing', 'trial') THEN 'pro'
    ELSE 'starter'
  END AS eff_tier
  FROM pocket_agent_subscriptions s
  WHERE s.user_id = u.id
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1
) sub ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM pa_cost_budgets b WHERE b.owner_id = u.id AND b.status = 'active'
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE pa_cost_events IS
  'Append-only cost ledger (PA-COST-2). One row per metered API call, owner-read RLS, service-role write, no update/delete.';
COMMENT ON TABLE pa_cost_budgets IS
  'Per-owner monthly cost budget (PA-COST-3), supersede-chain. One active row per owner; tier-default seeded.';
