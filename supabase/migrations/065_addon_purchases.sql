-- 065_addon_purchases.sql — Pocket Agent funnel v1 one-time add-on purchases (PA-FUNNEL-1..N).
--
-- The funnel sells three one-time products alongside the subscription ladder: the post-checkout
-- Done-With-You Setup (Standard $997 / Premium $2,500) offered on /upsell, and the $97 14-day Pilot
-- offered on /downsell to a visitor who won't commit to a subscription. These are charged once
-- (Stripe mode=payment), NOT subscription rungs, so they get their own append-only ledger instead
-- of riding the pocket_agent_subscriptions row. The Stripe webhook inserts one row per completed
-- one-time checkout (source=pocket_agent_addon) so the operator god-view (wc-admin) and the
-- post-purchase email drip both read from a single source of truth.
--
-- One additive table, owner-reads-own RLS. No destructive change. (Numbered 065: 057–064 were taken
-- by concurrent lanes — Cost budget gate, Decision Roundtable, Skills, Project Gates, Podcast watch,
-- Personas Apps, Follow-Up Sweeps, Landing Page Builder.)

CREATE TABLE IF NOT EXISTS pocket_agent_addon_purchases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The buyer's account, when they were signed in at checkout. Nullable: the /downsell pilot is
  -- bought by a not-yet-registered visitor, so the row is keyed by email + stripe ids until they
  -- create an account (claimed by email like the subscription row).
  user_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email               text,
  -- setup_standard | setup_premium | pilot
  kind                text NOT NULL,
  -- The Stripe Checkout Session that produced the charge. Unique so the webhook is idempotent
  -- across retries (a duplicate completed event is a no-op merge, not a second ledger row).
  stripe_session_id   text NOT NULL,
  -- The Stripe customer the charge is tied to (the same customer as the prior subscription session,
  -- for the /upsell setup charges). Nullable for the pilot, where there may be no prior customer.
  stripe_customer_id  text,
  stripe_payment_intent_id text,
  amount_cents        integer NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_addon_purchases_session
  ON pocket_agent_addon_purchases (stripe_session_id);

CREATE INDEX IF NOT EXISTS idx_pa_addon_purchases_user_created
  ON pocket_agent_addon_purchases (user_id, created_at DESC);

ALTER TABLE pocket_agent_addon_purchases ENABLE ROW LEVEL SECURITY;

-- Owner reads their own purchases only. The Stripe webhook holds the service-role key and bypasses
-- RLS to insert; this policy scopes owner-facing reads to their own rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pocket_agent_addon_purchases'
      AND policyname = 'pa_addon_purchases_owner_read'
  ) THEN
    CREATE POLICY pa_addon_purchases_owner_read ON pocket_agent_addon_purchases
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE pocket_agent_addon_purchases IS
  'Funnel v1 one-time purchases (PA-FUNNEL): Done-With-You Setup (setup_standard/setup_premium) from /upsell and the $97 Pilot from /downsell. Append-only ledger, one row per completed Stripe one-time checkout. Owner-reads-own RLS.';
