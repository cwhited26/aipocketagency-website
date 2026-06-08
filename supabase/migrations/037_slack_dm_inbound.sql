-- Connections: inbound Slack DM — carry the Slack identity on the pa_connections row.
-- Additive, idempotent migration. Adds two nullable columns so an inbound Slack event
-- (a DM to the bot, or an @mention) can be resolved back to the owner who installed PA in
-- that workspace. Never drops a column or a row.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL) via Supabase MCP.
--
-- Why these two columns:
--   • slack_user_id  — the installing user's Slack id (oauth.v2.access `authed_user.id`).
--       The inbound webhook matches the event's `user` field against this to find the owner.
--   • slack_team_id  — the workspace (team) id (oauth.v2.access `team.id`). Stored so a future
--       multi-workspace install can disambiguate; the lookup also filters on it when present.
--   Both are nullable: existing Slack rows (connected before this migration) carry NULL until
--   the owner reconnects, and a reconnect re-runs the callback which now persists both values.
--
-- The lookup index keeps the inbound hot path (resolve owner by slack_user_id) a single
-- index probe rather than a scan, and is partial so it only covers rows that actually carry
-- a Slack identity.

ALTER TABLE pa_connections ADD COLUMN IF NOT EXISTS slack_user_id text;
ALTER TABLE pa_connections ADD COLUMN IF NOT EXISTS slack_team_id text;

CREATE INDEX IF NOT EXISTS pa_connections_slack_user_id_idx
  ON pa_connections (slack_user_id)
  WHERE slack_user_id IS NOT NULL;
