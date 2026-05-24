-- Ensure upsertPocketAgentTrial can conflict-merge on stripe_subscription_id.
-- PostgREST ?on_conflict= requires a UNIQUE constraint on the target column.
-- Partial index (WHERE NOT NULL) avoids issues with rows that predate the
-- subscription linkage or were created without a subscription id.
--
-- If duplicate rows exist (from the period before this constraint), remove
-- them first by keeping the most recently updated one per subscription id.
DELETE FROM pocket_agent_subscriptions a
USING pocket_agent_subscriptions b
WHERE a.stripe_subscription_id = b.stripe_subscription_id
  AND a.stripe_subscription_id IS NOT NULL
  AND a.updated_at < b.updated_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pas_stripe_subscription_id_unique
  ON pocket_agent_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
