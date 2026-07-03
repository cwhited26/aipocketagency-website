-- 105_onboarding_progress.sql — Onboarding progress chip (PA-POS-36). Additive only.
--
-- One row per owner per completed onboarding step, written server-side by the code path that
-- performs the underlying action (first Connection insert, first Agent Builder approve, first
-- inbox approval, first Persona name, first Ritual, first teammate invite). There is no
-- "click to complete" write path — the app detects real work.
--
-- Credit bonuses ride the shipped PA-POS-30 machinery: an award is a pa_top_up_purchases row
-- with source='onboarding_bonus' and a synthetic session key (idempotent by the existing
-- stripe_session_id unique), so sumTopUpCredits folds it into the cycle like any Top Up and
-- the roll-forward carry keeps it. Studio+/Enterprise only — entry tiers see the same chip
-- with no credit surface (PA-POS-30 hard rule holds).

CREATE TABLE IF NOT EXISTS pa_onboarding_progress (
  owner_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_slug        TEXT        NOT NULL CHECK (step_slug IN (
                     'connect_tool',
                     'compose_agent',
                     'approve_inbox',
                     'name_persona',
                     'set_up_ritual',
                     'invite_teammate'
                   )),
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  credits_awarded  BOOLEAN     NOT NULL DEFAULT false,
  PRIMARY KEY (owner_id, step_slug)
);

CREATE INDEX IF NOT EXISTS pa_onboarding_progress_owner_idx
  ON pa_onboarding_progress (owner_id, completed_at DESC);

-- ── pa_top_up_purchases.source — segment paid Top Ups from onboarding bonus grants ──────────
-- Additive with a default so every existing row and every legacy write stays valid. The award
-- writer sets 'onboarding_bonus' with amount_paid_cents=0; paid checkouts keep the default.
ALTER TABLE pa_top_up_purchases
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'top_up'
  CHECK (source IN ('top_up', 'onboarding_bonus'));

-- ── RLS: owner reads their own rows; every write rides the service role from product routes ─
ALTER TABLE pa_onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_onboarding_progress_owner_select ON pa_onboarding_progress;
CREATE POLICY pa_onboarding_progress_owner_select
  ON pa_onboarding_progress
  FOR SELECT USING (owner_id = auth.uid());
