-- 064_landing_page_builder.sql — Landing Page Builder App (PA-LPB-1..6).
--
-- The one-tap wrapper around the shipped Build Tools (GitHub Build + Vercel connectors): the owner
-- describes the page they need, PA picks a template, writes the copy in their voice, generates the
-- Next.js component code, and stages each build step (create repo → push files → create Vercel
-- project → deploy) as a `build_action_approval` Inbox card. The owner approves each step; the
-- existing connector executors do the real work; this row tracks the page through the build.
--
-- One additive table, owner-scoped RLS, append-friendly. No destructive change. (Numbered 064: 057–062
-- were taken by concurrent lanes — Cost budget gate, Decision Roundtable, Skills, Project Gates,
-- Podcast watch, Personas Apps — and 063 by the Follow-Up Sweeps lane.)

CREATE TABLE IF NOT EXISTS pa_landing_pages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The PA Project this build belongs to (its Workspace gets the GitHub repo + Vercel project rows
  -- via the connector executors). Nullable: a page can be built without first opening a Project.
  project_id        uuid REFERENCES pa_projects(id) ON DELETE SET NULL,
  title             text NOT NULL,
  description       text NOT NULL DEFAULT '',
  -- single-cta | vertical-pack | personal-brand (validated in app code against the template catalog).
  template          text NOT NULL,
  -- { copy: { <sectionKey>: string }, files: { <path>: string } } — the generated copy strings and the
  -- assembled Next.js project files, persisted so a later staged push uses the same generation.
  generated_copy    jsonb,
  -- owner/name once the GitHub Build connector creates the repo.
  github_repo_name  text,
  -- the Vercel project id once the Vercel connector creates the project.
  vercel_project_id text,
  -- the live URL once the deploy completes (e.g. https://<slug>.vercel.app).
  vercel_url        text,
  -- a custom domain the owner attached later via the Vercel attachDomain connector.
  custom_domain     text,
  -- planning | building | live | failed
  status            text NOT NULL DEFAULT 'planning',
  -- Build cursor: plan | repo | push | project | deploy | live | failed. Names the step currently
  -- staged for approval (or the terminal phase). Drives the advance-on-approval state machine.
  build_step        text NOT NULL DEFAULT 'plan',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_landing_pages_owner_updated
  ON pa_landing_pages (owner_id, updated_at DESC);

ALTER TABLE pa_landing_pages ENABLE ROW LEVEL SECURITY;

-- Owner reads/writes their own pages only. The headless build surfaces hold the service-role key and
-- bypass RLS; this policy scopes the owner-facing reads (and any owner-initiated writes) to their rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pa_landing_pages' AND policyname = 'pa_landing_pages_owner_all'
  ) THEN
    CREATE POLICY pa_landing_pages_owner_all ON pa_landing_pages
      FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE pa_landing_pages IS
  'Landing Page Builder (PA-LPB-1). One row per owner landing page; tracks template, generated copy/code, and the GitHub+Vercel build artifacts through an approval-gated build. Owner-scoped RLS.';
