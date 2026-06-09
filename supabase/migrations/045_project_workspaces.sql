-- 045_project_workspaces.sql — the Project Workspace primitive (PA-BUILD-7 / PA-BUILD-8).
--
-- Build Tools Roadmap §7.5 + §8.1. A build Project (a Wave B Scaffolding plan) provisions artifacts
-- across four providers — a GitHub repo, a Vercel project, a Supabase project, a Modal container.
-- Without a single record tying them together, a multi-connector build is a scatter of unrelated
-- side-effects with no answer to "where did this all end up." This table is that record: one row per
-- Project, holding the reference to each artifact the plan provisioned, so the Projects-tab Workspace
-- panel can render them as live links on the owner's own accounts.
--
-- Each of the four downstream connector lanes (GitHub Build, Vercel, Supabase, Modal Sandbox) writes
-- its artifact reference back here via POST /api/app/projects/[id]/workspace as its provisioning
-- action lands. The columns stay null until the matching action fires — a brand-new project has a row
-- (or none) with every artifact column empty, which the UI renders as the empty state.
--
-- Everything here is additive and non-destructive (same rule as APA-ORCH-21 / the brain's migration
-- standing rule). One table, one unique constraint, one index, owner-scoped RLS.
--
-- Column shape follows §8.1, refined to carry both the stable id AND the human-readable name for each
-- artifact so the panel can show a label without a second provider round-trip:
--   github_repo_url / github_repo_full_name  — the clone URL + owner/repo slug
--   vercel_project_id / vercel_project_name  — the Vercel project id + its name
--   supabase_project_ref / supabase_project_name — the Supabase ref (deep-links the dashboard) + name
--   modal_container_id                        — the most recent / active container, null when none
--
-- status lifecycle: provisioning (default, plan accepted, artifacts landing) → live (build deployed)
--   → failed (a provisioning step errored) → archived (owner retired the project). The stored status
--   is the authoritative lifecycle label; the API also computes a per-artifact "X of 4 provisioned"
--   view from the columns above.
--
-- RLS: owner-reads/writes-own (owner_id = auth.uid()) for defense in depth. Server access goes through
-- the service-role key scoped by owner_id (the established PA pattern — pa_projects works the same
-- way), and the service role bypasses RLS, so the policy is the floor for direct authenticated access.

CREATE TABLE IF NOT EXISTS pa_project_workspaces (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The originating Wave B Project / Scaffolding plan. One workspace per project.
  project_id             uuid NOT NULL REFERENCES pa_projects(id) ON DELETE CASCADE,
  owner_id               uuid NOT NULL,
  -- GitHub Build artifact (§7.1). Null until create_repo lands.
  github_repo_url        text,
  github_repo_full_name  text,
  -- Vercel artifact (§7.2). Null until create_project lands.
  vercel_project_id      text,
  vercel_project_name    text,
  -- Supabase artifact (§7.3). Null until Supabase create_project lands. The ref deep-links the
  -- Supabase dashboard.
  supabase_project_ref   text,
  supabase_project_name  text,
  -- Modal Sandbox artifact (§7.4). Most recent / active container, null when none running.
  modal_container_id     text,
  status                 text NOT NULL DEFAULT 'provisioning'
                           CHECK (status IN ('provisioning', 'live', 'failed', 'archived')),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- One workspace per project. Lets the connector lanes upsert their artifact (POST with
-- on_conflict=project_id) atomically, so four lanes firing in parallel each extend the same row
-- instead of racing to create duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS pa_project_workspaces_project_uniq
  ON pa_project_workspaces (project_id);

CREATE INDEX IF NOT EXISTS pa_project_workspaces_owner_idx
  ON pa_project_workspaces (owner_id, updated_at DESC);

-- ── RLS (owner-scoped; service role bypasses) ───────────────────────────────────
ALTER TABLE pa_project_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_project_workspaces_owner_all ON pa_project_workspaces;
CREATE POLICY pa_project_workspaces_owner_all ON pa_project_workspaces
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
