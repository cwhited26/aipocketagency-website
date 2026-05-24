-- Enable RLS on pocket_agent_subscriptions.
-- All server-side reads/writes use the service-role key (bypasses RLS),
-- so enabling this has no effect on the paywall gate or any webhook path.
-- The SELECT policy lets a logged-in user read their own row if a client-
-- side query is ever needed; INSERT/UPDATE/DELETE remain server-only.
ALTER TABLE pocket_agent_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_subscription"
  ON pocket_agent_subscriptions
  FOR SELECT
  USING (user_id = auth.uid());
