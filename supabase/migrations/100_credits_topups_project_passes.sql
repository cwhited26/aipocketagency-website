-- 100_credits_topups_project_passes.sql — Credits + Top Ups (PA-POS-30) and Project Passes
-- (PA-POS-31): metered access layered on top of the tier. Additive only.
--
-- Two hard product rules baked into this schema:
--   1. Credits exist ONLY for studio_plus / enterprise. Personal Brain + Business Agent never
--      get an allowance row — entry tiers stay pure flat (PA-POS-30, Twin's credit-anxiety trap).
--   2. Project Passes rent a gated App to a lower tier for a bounded window (7 days or a run
--      budget). Passes never throttle, never auto-discount, never block a repeat purchase —
--      customer autonomy is the rule (PA-POS-31 amendment, 2026-07-03).

-- ── pa_credit_allowances — one row per owner per billing cycle (studio_plus/enterprise only) ─
-- consumed_credits is a cached rollup; the source of truth is SUM(pa_cost_events.cost_micro_cents)
-- since cycle_start, converted at the credit rate (lib/credits/convert.ts). The cache exists so
-- the chip render is one indexed read, and it is recomputed on every allowance check.
CREATE TABLE IF NOT EXISTS pa_credit_allowances (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_slug          TEXT        NOT NULL CHECK (tier_slug IN ('studio_plus', 'enterprise')),
  cycle_start        TIMESTAMPTZ NOT NULL,
  cycle_end          TIMESTAMPTZ NOT NULL,
  allowance_credits  INTEGER     NOT NULL,
  consumed_credits   INTEGER     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, cycle_start)
);

CREATE INDEX IF NOT EXISTS pa_credit_allowances_owner_cycle_idx
  ON pa_credit_allowances (owner_id, cycle_end DESC);

-- ── pa_top_up_purchases — one row per completed Top Up checkout (idempotent by session) ─────
CREATE TABLE IF NOT EXISTS pa_top_up_purchases (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id  TEXT        NOT NULL UNIQUE,
  credits_added      INTEGER     NOT NULL,
  amount_paid_cents  INTEGER     NOT NULL,
  purchased_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_top_up_purchases_owner_idx
  ON pa_top_up_purchases (owner_id, purchased_at DESC);

-- ── pa_project_passes — one row per rented App window (idempotent by session) ────────────────
-- Time-based Apps (landing_page_builder, browser_agent, agent_builder) get expires_at = +7 days;
-- run-based Apps (idea_engine, roundtable) get remaining_run_budget = 1 and a far expires_at.
-- A pass is active while expires_at > now() AND (remaining_run_budget IS NULL OR > 0).
CREATE TABLE IF NOT EXISTS pa_project_passes (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_slug                      TEXT        NOT NULL,
  granted_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at                    TIMESTAMPTZ NOT NULL,
  remaining_run_budget          INTEGER,
  price_paid_cents_at_purchase  INTEGER     NOT NULL,
  tier_at_purchase              TEXT        NOT NULL,
  stripe_session_id             TEXT        NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS pa_project_passes_owner_app_idx
  ON pa_project_passes (owner_id, app_slug, expires_at DESC);

-- ── pa_cost_events.entitlement_source — segment rented vs tier-included vs top-up usage ─────
-- Additive with a default so every existing row and every legacy write stays valid. Analytics
-- (the /admin/passes leaderboard, nudge calibration) split on this column.
ALTER TABLE pa_cost_events
  ADD COLUMN IF NOT EXISTS entitlement_source TEXT NOT NULL DEFAULT 'tier'
  CHECK (entitlement_source IN ('tier', 'project_pass', 'top_up'));

-- ── pa_browser_jobs.entitlement_source — how this job was entitled at creation ──────────────
-- Set once by the create route (tier vs active Project Pass); the cron worker copies it onto
-- every step's pa_cost_events row so Browser Agent spend segments cleanly. Additive + default.
ALTER TABLE pa_browser_jobs
  ADD COLUMN IF NOT EXISTS entitlement_source TEXT NOT NULL DEFAULT 'tier'
  CHECK (entitlement_source IN ('tier', 'project_pass'));

-- ── RLS: owner reads their own rows; every write rides the service role from gated routes ───
ALTER TABLE pa_credit_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_top_up_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_project_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_credit_allowances_owner_select ON pa_credit_allowances;
CREATE POLICY pa_credit_allowances_owner_select
  ON pa_credit_allowances
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS pa_top_up_purchases_owner_select ON pa_top_up_purchases;
CREATE POLICY pa_top_up_purchases_owner_select
  ON pa_top_up_purchases
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS pa_project_passes_owner_select ON pa_project_passes;
CREATE POLICY pa_project_passes_owner_select
  ON pa_project_passes
  FOR SELECT USING (owner_id = auth.uid());
