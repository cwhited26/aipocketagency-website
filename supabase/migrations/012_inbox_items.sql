-- Inbox: drafts staged for approval + yes/no decisions
-- Additive migration — never drops anything.
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL).
-- RLS: users SELECT their own rows; all writes via the service-role key in server routes.
--
-- This is the canonical staging table for the Pocket Agent Inbox (/app/apps/inbox).
-- It sits alongside (does not replace) pocket_agent_pending_actions — the legacy
-- brain-memory approval gate (008) still executes through its own path, and its
-- pending rows are merged into the Inbox UI read-side.

CREATE TABLE IF NOT EXISTS pa_inbox_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         TEXT        NOT NULL
                             CHECK (kind IN ('draft','decision')),
  title        TEXT        NOT NULL,
  body_md      TEXT,
  source       TEXT,
  payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status       TEXT        NOT NULL
                             CHECK (status IN ('pending','approved','rejected','expired'))
                             DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at   TIMESTAMPTZ
);

-- Hot path: "show me my pending items" and the live count badge.
CREATE INDEX IF NOT EXISTS idx_pa_inbox_user_status
  ON pa_inbox_items (user_id, status);

ALTER TABLE pa_inbox_items ENABLE ROW LEVEL SECURITY;

-- Users may read their own rows only (payload + body shown in the Inbox UI).
DROP POLICY IF EXISTS "inbox_select_own" ON pa_inbox_items;
CREATE POLICY "inbox_select_own"
  ON pa_inbox_items
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT / UPDATE / DELETE are denied for the anon/authenticated role by default
-- (no policy granted). Every write happens via the service-role key in server
-- routes (create draft, approve, reject), which always scope by user_id and
-- enforce an ownership gate before mutating.
