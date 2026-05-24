-- Phase 3c: Approval gate — pending actions table
-- Additive migration — never drops anything.
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL).
-- RLS: users SELECT their own rows; all writes via service-role key in server routes.

CREATE TABLE IF NOT EXISTS pocket_agent_pending_actions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type  TEXT        NOT NULL
                             CHECK (action_type IN ('update_brain_memory')),
  status       TEXT        NOT NULL
                             CHECK (status IN ('pending','approved','executing','executed','rejected','failed'))
                             DEFAULT 'pending',
  title        TEXT        NOT NULL,
  summary      TEXT        NOT NULL,
  payload      JSONB       NOT NULL,
  result       JSONB,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ,
  executed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_papa_user_status
  ON pocket_agent_pending_actions (user_id, status);

ALTER TABLE pocket_agent_pending_actions ENABLE ROW LEVEL SECURITY;

-- Users may read their own rows (payload content is shown in the Inbox approval UI).
CREATE POLICY "actions_select_own"
  ON pocket_agent_pending_actions
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT / UPDATE / DELETE are denied for the anon/user role by default.
-- All writes happen via the service-role key in server routes (approve, reject, propose).
