-- 075_enterprise_applications.sql — Pocket Agent Enterprise application intake (GTM Phase 2).
--
-- The Enterprise funnel (Part 8) filters high-ticket prospects: the public /enterprise landing page
-- routes to /enterprise/apply, a 31-question application across 7 sections. Each submission lands here
-- as one row, the qualification score + recommended route are computed server-side at insert time
-- (src/lib/enterprise/scoring.ts, Part 8G), and the prospect is redirected to /enterprise/thanks.
--
-- The form is PUBLIC and unauthenticated (prospects apply before they have an account), so the
-- /api/enterprise/apply route inserts with the service-role key. RLS is enabled with NO policies:
-- anon/authenticated clients can neither read nor write directly (deny-all), and the only write path
-- is the service-role insert in the route. Operator reads (Chase / team) go through the service-role
-- key behind the src/lib/operator.ts isOperatorEmail gate — never a broad client-readable policy,
-- because this table holds prospect contact + business detail. Additive + idempotent.

CREATE TABLE IF NOT EXISTS pa_enterprise_applications (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                timestamptz NOT NULL DEFAULT now(),

  -- Section 1: Contact info
  email                     text NOT NULL,
  first_name                text,
  last_name                 text,
  phone                     text,
  company                   text NOT NULL,
  website                   text,
  role                      text NOT NULL,

  -- Section 2: Business profile
  business_type             text,
  what_you_sell             text NOT NULL,
  who_you_sell_to           text,
  monthly_revenue_range     text,
  team_size                 text,

  -- Section 3: Current AI usage
  current_ai_tools          text[] NOT NULL DEFAULT '{}',
  current_ai_pain           text NOT NULL,
  context_locations         text[] NOT NULL DEFAULT '{}',

  -- Section 4: Workflow needs
  desired_workflows         text[] NOT NULL DEFAULT '{}',
  biggest_bottleneck        text NOT NULL,
  success_outcome           text,
  interested_apps           text[] NOT NULL DEFAULT '{}',

  -- Section 5: Usage and team requirements
  high_volume_usage         text,
  needs_permissions         text,
  needs_byo_llm             text,
  needs_integrations        text,
  integration_systems       text,

  -- Section 6: Implementation readiness
  timeline                  text,
  implementation_owner      text,
  willing_to_gather_context text,
  used_pocket_agent_before  text,

  -- Section 7: Budget and fit
  budget_range              text,
  dwy_interest              text,
  additional_notes          text,

  -- Computed at insert (Part 8G qualification scoring + routing)
  qualification_score       integer NOT NULL DEFAULT 0,
  qualification_route       text NOT NULL DEFAULT 'pilot'
);

-- Operator views list newest-first; the route lens powers the fit-bucket breakdown.
CREATE INDEX IF NOT EXISTS pa_enterprise_applications_created_idx
  ON pa_enterprise_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS pa_enterprise_applications_route_idx
  ON pa_enterprise_applications (qualification_route);

-- Deny-all RLS: no policies. The service-role key (used by /api/enterprise/apply and operator reads)
-- bypasses RLS; anon/authenticated clients get nothing. This table holds prospect PII.
ALTER TABLE pa_enterprise_applications ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pa_enterprise_applications IS
  'Pocket Agent Enterprise application intake (Part 8E, 31 questions). Public unauthenticated form; inserted via service-role key with server-computed qualification_score/route (Part 8G). RLS deny-all — operator reads go through service-role behind isOperatorEmail. GTM Phase 2.';
