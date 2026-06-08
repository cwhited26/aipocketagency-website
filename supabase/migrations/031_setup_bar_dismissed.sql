-- 031_setup_bar_dismissed.sql
-- Additive: remember when an owner explicitly hides the "Finish setting up your agent"
-- status bar on the Agent landing, so it stays hidden across devices and sessions until
-- they bring it back from Settings. NULL = never dismissed (the default).
ALTER TABLE pocket_agent_users
  ADD COLUMN IF NOT EXISTS setup_bar_dismissed_at timestamptz;
