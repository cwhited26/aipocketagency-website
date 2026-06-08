-- System transactional email audit log (connector.email.system_send)
-- Additive migration — never drops anything.
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL).
-- RLS: users SELECT their own rows; all writes via the service-role key in server code.
--
-- One row per PA-originated system email (Daily Brief notification, approval-needed ping,
-- connection re-auth alert). The idempotency_key UNIQUE constraint is the cross-invocation
-- dedupe guard: a retried trigger claims the same key, hits 23505, and the send is skipped
-- instead of mailing the user twice. Keys are derived from the source event:
--   daily_brief:<user_id>:<YYYY-MM-DD>   approval_needed:<inbox_item_id>   connection_reauth:<connection_id>
--
-- This is system mail PA sends FROM its own verified sender (chase@aipocketagency.com) — distinct
-- from connector.gmail.send, which sends AS the user from their own Gmail and is approval-gated.

CREATE TABLE IF NOT EXISTS pa_system_email_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_address       TEXT        NOT NULL,
  subject          TEXT        NOT NULL,
  resend_id        TEXT,
  idempotency_key  TEXT        NOT NULL UNIQUE,
  status           TEXT        NOT NULL
                                 CHECK (status IN ('pending','sent','failed'))
                                 DEFAULT 'pending',
  error_message    TEXT,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Show me this user's system mail, newest first" (support / debugging).
CREATE INDEX IF NOT EXISTS idx_pa_system_email_user_created
  ON pa_system_email_log (user_id, created_at DESC);

ALTER TABLE pa_system_email_log ENABLE ROW LEVEL SECURITY;

-- Users may read their own audit rows only.
DROP POLICY IF EXISTS "system_email_select_own" ON pa_system_email_log;
CREATE POLICY "system_email_select_own"
  ON pa_system_email_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT / UPDATE / DELETE are denied for the anon/authenticated role by default (no policy
-- granted). Every write happens via the service-role key in server code (claim / mark sent /
-- mark failed), which always scopes by user_id and the unique idempotency key.
