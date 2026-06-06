-- 020_pocket_agent_tier.sql — PA-ORCH-10 unified SMB tier ladder + SPEC v4 Wave 3 dev add-ons.
--
-- The Stripe webhook maps the active price ID on a customer.subscription.* event to an
-- SMB tier (starter | pro | pro_plus | studio | studio_plus | enterprise) and writes it
-- here. lib/personas/tier-caps.ts#getCurrentTier reads this column to drive entitlements;
-- when null it falls back to the legacy status→pro mapping, so this migration is safe to
-- apply before or after the webhook ships.
--
-- PA Sync ($96/yr) and PA Publish ($200/yr) are orthogonal dev add-ons — boolean flags,
-- not tiers. They never overwrite `tier`.

alter table public.pocket_agent_subscriptions
  add column if not exists tier text,
  add column if not exists addon_sync boolean not null default false,
  add column if not exists addon_publish boolean not null default false;

-- Constrain tier to the known ladder values (allow null = "no tier provisioned yet").
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pocket_agent_subscriptions_tier_check'
  ) then
    alter table public.pocket_agent_subscriptions
      add constraint pocket_agent_subscriptions_tier_check
      check (tier is null or tier in (
        'starter', 'pro', 'pro_plus', 'studio', 'studio_plus', 'enterprise'
      ));
  end if;
end $$;

comment on column public.pocket_agent_subscriptions.tier is
  'SMB ladder tier (PA-ORCH-10) written by the Stripe webhook from the active price ID. Null = fall back to status-based mapping.';
comment on column public.pocket_agent_subscriptions.addon_sync is
  'PA Sync ($96/yr) dev add-on active (SPEC v4 Wave 3). Orthogonal to tier.';
comment on column public.pocket_agent_subscriptions.addon_publish is
  'PA Publish ($200/yr) dev add-on active (SPEC v4 Wave 3). Orthogonal to tier.';
