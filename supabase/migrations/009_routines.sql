-- Phase: Routines — recurring agent tasks
-- Additive migration — never drops existing data.
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL).

-- ─── Extend pending_actions to include routine_output ─────────────────────────
-- Drop the existing CHECK and add a new one with the expanded set.
ALTER TABLE pocket_agent_pending_actions
  DROP CONSTRAINT IF EXISTS pocket_agent_pending_actions_action_type_check;

ALTER TABLE pocket_agent_pending_actions
  ADD CONSTRAINT pocket_agent_pending_actions_action_type_check
    CHECK (action_type IN ('update_brain_memory', 'routine_output'));

-- ─── Routines table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pocket_agent_routines (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT        NOT NULL
                              CHECK (kind IN ('daily_brief', 'followup_sweep', 'weekly_digest')),
  enabled       BOOLEAN     NOT NULL DEFAULT true,
  schedule_cron TEXT        NOT NULL,
  last_run_at   TIMESTAMPTZ,
  next_run_at   TIMESTAMPTZ,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

-- Fast cron query: due enabled routines ordered by next_run_at
CREATE INDEX IF NOT EXISTS idx_par_enabled_next
  ON pocket_agent_routines (enabled, next_run_at);

ALTER TABLE pocket_agent_routines ENABLE ROW LEVEL SECURITY;

-- Users may read their own rows (displayed in /app/routines).
-- All writes happen via the service-role key in server routes.
CREATE POLICY "routines_select_own"
  ON pocket_agent_routines
  FOR SELECT
  USING (auth.uid() = user_id);
