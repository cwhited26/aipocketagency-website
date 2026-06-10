-- 069_setup_sprints.sql — AI Office Setup Sprint fulfillment (PA-SPRINT-1..6).
--
-- The Setup Sprint is the Done-With-You Setup the owner buys on /upsell ($997 standard / $2,500 premium).
-- This table is the operator-facing fulfillment record: it's created by the Stripe webhook when the
-- Done-With-You add-on purchase completes (kind setup_standard / setup_premium), then carries the owner
-- through intake → scheduled call → completed.
--
-- intake holds the pre-call form responses (business name, offerings, target customer, current admin
-- pain, the top 3 workflows they want set up) as jsonb — one form, no satellite table. current_step is a
-- plain-English label of where the sprint sits (e.g. 'awaiting_intake', 'call_scheduled', 'building',
-- 'done') so the owner's dashboard and the operator admin view read the same cursor.
--
-- RLS: owner-scoped SELECT so the owner sees their own sprint on /app/setup-sprint. The operator admin
-- view (/admin/setup-sprints) reads via the service-role key (operator gate is enforced in the route,
-- src/lib/operator.ts), so no broad admin policy is added here. Additive + idempotent.

-- ── pa_setup_sprints — one row per purchased Setup Sprint ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_setup_sprints (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  email              text,
  tier               text NOT NULL CHECK (tier IN ('standard', 'premium')),
  stripe_session_id  text NOT NULL,
  intake             jsonb NOT NULL DEFAULT '{}'::jsonb,
  intake_submitted_at timestamptz,
  call_scheduled_at  timestamptz,
  completed_at       timestamptz,
  current_step       text NOT NULL DEFAULT 'awaiting_intake',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Idempotent against webhook retries: one sprint per Stripe session.
CREATE UNIQUE INDEX IF NOT EXISTS pa_setup_sprints_session_idx
  ON pa_setup_sprints (stripe_session_id);
-- The owner dashboard reads the owner's most recent sprint; the admin view lists all active sprints.
CREATE INDEX IF NOT EXISTS pa_setup_sprints_owner_created_idx
  ON pa_setup_sprints (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pa_setup_sprints_step_idx
  ON pa_setup_sprints (current_step);

ALTER TABLE pa_setup_sprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_setup_sprints_owner_select ON pa_setup_sprints;
CREATE POLICY pa_setup_sprints_owner_select ON pa_setup_sprints
  FOR SELECT USING (owner_id = auth.uid());

COMMENT ON TABLE pa_setup_sprints IS
  'Operator-facing fulfillment record for a purchased Done-With-You Setup Sprint (standard/premium). Created by the Stripe webhook; carries intake → scheduled call → completed. PA-SPRINT-1..6.';
