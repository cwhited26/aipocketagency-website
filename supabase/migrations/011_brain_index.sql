-- additive: per-user memory index (backfill from connected brain repos)

CREATE TABLE pocket_agent_memory_index (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  path          text        NOT NULL,
  file_sha      text        NOT NULL,
  name          text,
  description   text,
  type          text        NOT NULL DEFAULT 'unknown',
  frontmatter_raw jsonb     NOT NULL DEFAULT '{}',
  body_excerpt  text,
  indexed_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, path)
);

CREATE INDEX pocket_agent_memory_index_user_type_idx
  ON pocket_agent_memory_index (user_id, type);

CREATE INDEX pocket_agent_memory_index_user_indexed_at_idx
  ON pocket_agent_memory_index (user_id, indexed_at DESC);

ALTER TABLE pocket_agent_memory_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory index"
  ON pocket_agent_memory_index
  FOR SELECT
  USING (auth.uid() = user_id);

-- Root-file index (CLAUDE.md / MEMORY.md / AGENTS.md presence) and last-indexed timestamp.
-- Stored as a JSONB column on pocket_agent_users to avoid an extra table.
ALTER TABLE pocket_agent_users
  ADD COLUMN IF NOT EXISTS brain_root_index_json  jsonb,
  ADD COLUMN IF NOT EXISTS brain_indexed_at        timestamptz;
