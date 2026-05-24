-- Fix 3: Subscription ↔ auth-user linkage
-- Run against the pocket_agent Supabase project (bos-internal / earhglnkxdthsbraazmj)
ALTER TABLE pocket_agent_subscriptions ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE INDEX IF NOT EXISTS idx_pas_user_id ON pocket_agent_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_pas_email ON pocket_agent_subscriptions(email);
