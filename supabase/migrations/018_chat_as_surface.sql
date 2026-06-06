-- PA v5 Wave A — Chat-as-surface refactor.
-- Additive migration — creates the chat-history tables only. Never drops anything.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL) via Supabase MCP after the
-- lane lands. Wave A ships behind the env flag PA_CHAT_AS_HOME — the schema is harmless to
-- apply early; the /app/home surface redirects back to the tabbed UI until the flag is set
-- on Vercel.
--
-- Scoping model: PA is one-business-per-user. `user_id` is the owner's auth user id
-- (= pocket_agent_users.id = auth.users.id). RLS lets an owner read their own rows
-- (user_id = auth.uid()). All WRITES go through the service-role key in server routes
-- (which bypasses RLS) and are scoped by user_id in the query — mirroring the existing PA
-- data-access pattern (lib/pa-supabase.ts, lib/personas/db.ts).
--
-- Append-only: a chat message is NEVER deleted. "Removing" a message sets archived_at;
-- read paths filter archived_at IS NULL by default.

-- ── pa_chat_messages ─────────────────────────────────────────────────────────────────
-- The owner's single, persistent chat-history log. Every user message, assistant reply,
-- system note, and inline card is one append-only row. Inline cards carry a card_kind +
-- card_payload (jsonb). filter_tags scopes a row to one of the slash-command views; rows
-- not tied to a specific view carry ['general'].
CREATE TABLE IF NOT EXISTS pa_chat_messages (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role               TEXT        NOT NULL
                       CHECK (role IN ('user', 'assistant', 'system', 'inline_card')),
  content            TEXT        NOT NULL DEFAULT '',
  -- card_kind is set only when role = 'inline_card'. Enumerated so a typo can't land a
  -- card the renderer doesn't know how to draw.
  card_kind          TEXT
                       CHECK (card_kind IS NULL OR card_kind IN (
                         'memory_write', 'persona_invoke', 'doc_preview', 'voice_memo',
                         'screenshot', 'sub_agent_activity', 'action_approval',
                         'persona_response'
                       )),
  card_payload       JSONB,
  -- Threading: replies + (Wave B) sub-agent activity hang off a parent message.
  parent_message_id  UUID        REFERENCES pa_chat_messages(id) ON DELETE SET NULL,
  -- One row is scoped to one-or-more slash-command views. Default ['general'].
  filter_tags        TEXT[]      NOT NULL DEFAULT ARRAY['general']::TEXT[],
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at        TIMESTAMPTZ,

  -- An inline_card must declare its kind; a non-card row must not.
  CONSTRAINT pa_chat_messages_card_kind_role CHECK (
    (role = 'inline_card' AND card_kind IS NOT NULL)
    OR (role <> 'inline_card' AND card_kind IS NULL)
  ),
  -- filter_tags entries are constrained at the application layer (lib/chat/filters.ts);
  -- Postgres can't cheaply CHECK array membership, so the app is the gate.
  CONSTRAINT pa_chat_messages_filter_tags_nonempty CHECK (
    array_length(filter_tags, 1) >= 1
  )
);

-- Primary read path: a user's live (non-archived) history, newest first, paginated.
CREATE INDEX IF NOT EXISTS idx_pa_chat_messages_user_created
  ON pa_chat_messages (user_id, created_at DESC)
  WHERE archived_at IS NULL;

-- Filter-view path: filter_tags @> ARRAY['tasks'] etc.
CREATE INDEX IF NOT EXISTS idx_pa_chat_messages_filter_tags
  ON pa_chat_messages USING GIN (filter_tags);

-- Thread lookups.
CREATE INDEX IF NOT EXISTS idx_pa_chat_messages_parent
  ON pa_chat_messages (parent_message_id)
  WHERE parent_message_id IS NOT NULL;

ALTER TABLE pa_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_chat_messages_select_own" ON pa_chat_messages;
CREATE POLICY "pa_chat_messages_select_own" ON pa_chat_messages
  FOR SELECT USING (user_id = auth.uid());

-- ── pa_chat_filter_state ─────────────────────────────────────────────────────────────
-- One row per owner: the slash-command filter currently applied to their chat surface, so
-- the view they last selected survives a reload + follows them across devices.
CREATE TABLE IF NOT EXISTS pa_chat_filter_state (
  user_id        UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_filter TEXT        NOT NULL DEFAULT 'general',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pa_chat_filter_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_chat_filter_state_select_own" ON pa_chat_filter_state;
CREATE POLICY "pa_chat_filter_state_select_own" ON pa_chat_filter_state
  FOR SELECT USING (user_id = auth.uid());
