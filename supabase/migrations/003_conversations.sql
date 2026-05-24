-- Phase 1a: Conversation persistence
-- Additive migration: two new tables only

CREATE TABLE IF NOT EXISTS pocket_agent_conversations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  title       TEXT        NOT NULL DEFAULT 'New conversation',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pac_user_id_updated
  ON pocket_agent_conversations (user_id, updated_at DESC);

ALTER TABLE pocket_agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_conversations"
  ON pocket_agent_conversations
  FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS pocket_agent_messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID        NOT NULL REFERENCES pocket_agent_conversations(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL,
  role              TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content           TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pam_conversation_id_created
  ON pocket_agent_messages (conversation_id, created_at ASC);

ALTER TABLE pocket_agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_messages"
  ON pocket_agent_messages
  FOR ALL
  USING (auth.uid() = user_id);
