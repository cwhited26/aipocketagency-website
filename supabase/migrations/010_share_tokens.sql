-- additive: per-user share tokens for iOS Shortcut inbox
CREATE TABLE pocket_agent_share_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  token       text        UNIQUE NOT NULL,
  label       text        NOT NULL DEFAULT 'iOS Share',
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at  timestamptz
);

CREATE INDEX pocket_agent_share_tokens_token_idx
  ON pocket_agent_share_tokens (token);

CREATE INDEX pocket_agent_share_tokens_user_id_idx
  ON pocket_agent_share_tokens (user_id);

ALTER TABLE pocket_agent_share_tokens ENABLE ROW LEVEL SECURITY;

-- Users may SELECT their own rows; all writes go through service role only
CREATE POLICY "Users can view own share tokens"
  ON pocket_agent_share_tokens
  FOR SELECT
  USING (auth.uid() = user_id);
