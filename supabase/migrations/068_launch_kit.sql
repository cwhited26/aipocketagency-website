-- 068_launch_kit.sql — AI Office Launch Kit (PA-LAUNCHKIT-IMPL-1..6).
--
-- The Launch Kit is the free bonus that ships with every paid subscription: a guided walkthrough that
-- gets the workspace running (Business Brain setup checklist, 3 starter personas, 5 starter workflow
-- recipes, a Mission Control review, and a 7-day plan). The static content lives in markdown under
-- src/data/launch-kit/ and is rendered by /app/launch-kit. The only state we persist is per-step
-- completion so the owner can pick up where they left off and the Implementation Guarantee can be checked.
--
-- One new owner-scoped table. Additive + idempotent. RLS mirrors the sibling tables (044 / 063 / 066):
-- owner-scoped SELECT for the page; all writes go through the service-role key from the progress API
-- route (which gates ownership before mutating).

-- ── pa_launch_kit_progress — one row per completed step ──────────────────────────────────────────
-- step_slug matches a step id defined in src/lib/launch-kit/steps.ts. A row exists only once a step is
-- completed; absence means not-yet-done. UNIQUE(owner_id, step_slug) makes marking a step idempotent.
CREATE TABLE IF NOT EXISTS pa_launch_kit_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  step_slug    text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pa_launch_kit_progress_owner_step_idx
  ON pa_launch_kit_progress (owner_id, step_slug);
-- The page reads all of an owner's completed steps on load — index that read (owner_id).
CREATE INDEX IF NOT EXISTS pa_launch_kit_progress_owner_idx
  ON pa_launch_kit_progress (owner_id);

ALTER TABLE pa_launch_kit_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_launch_kit_progress_owner_select ON pa_launch_kit_progress;
CREATE POLICY pa_launch_kit_progress_owner_select ON pa_launch_kit_progress
  FOR SELECT USING (owner_id = auth.uid());

COMMENT ON TABLE pa_launch_kit_progress IS
  'Per-step completion for the AI Office Launch Kit walkthrough. Content is static markdown in src/data/launch-kit/; this table only tracks which steps an owner has finished. PA-LAUNCHKIT-IMPL-1..6.';
