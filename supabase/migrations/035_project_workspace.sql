-- 035_project_workspace.sql — Projects become an execution unit AND a context container.
--
-- Before this migration a "project" lived only as a scaffold file in the owner's brain repo
-- (goal + milestones + tasks, surfaced read-only on /app/projects). This adds the holding-context
-- layer so a project can carry the rules, memory, reference docs, and linked conversations the
-- agent works inside — a project-scoped CLAUDE.md analog.
--
-- Everything here is additive and non-destructive:
--
-- 1. pa_projects — the project entity. `instructions` is the per-project rulebook that prepends to
--    every conversation linked to the project. `scaffold_slug` optionally points at the brain
--    scaffold that backs the Plan tab (milestones + tasks), so the execution unit and the context
--    container stay one thing.
--
-- 2. pa_project_memory — project-scoped memory. Memory the agent saves while working inside a
--    project lands here, NOT in the global brain, so a client engagement's notes don't leak into
--    every other conversation.
--
-- 3. pa_project_references — reference docs uploaded to a project. Every conversation in the
--    project can read `content_text` (extracted on upload). `file_path` is the asset path when the
--    bytes were also persisted to the brain; null for paste-in / text-only references.
--
-- 4. pocket_agent_conversations gains `project_id` (which project a thread belongs to, null = a
--    loose thread) and `pinned` (pin a thread to the top of the project's Conversations list).
--    Existing rows keep project_id = NULL / pinned = false and behave exactly as before.
--
-- RLS: the new tables enable RLS with owner-reads/writes-own policies (owner_id = auth.uid()) for
-- defense in depth. Server access goes through the service-role key scoped by owner_id (the
-- established PA pattern — pocket_agent_conversations works the same way), and the service role
-- bypasses RLS, so the policies are the floor for any direct authenticated-client access.

-- ── 1. pa_projects ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL,
  title         text NOT NULL,
  -- One-line outcome the project is driving toward. Optional — a project can start as a bare
  -- context container and grow a goal later.
  goal          text,
  -- The per-project rulebook. Prepends to every linked conversation's system prompt. Null/empty
  -- until the owner fills it in (the Setup readiness pill turns green once it's set).
  instructions  text,
  -- Optional link to the brain scaffold (scaffolds/<slug>/scaffolding.md) that backs the Plan tab.
  scaffold_slug text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_projects_owner_idx ON pa_projects (owner_id, updated_at DESC);

-- ── 2. pa_project_memory ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_project_memory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES pa_projects(id) ON DELETE CASCADE,
  owner_id    uuid NOT NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_project_memory_project_idx ON pa_project_memory (project_id, created_at DESC);

-- ── 3. pa_project_references ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_project_references (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES pa_projects(id) ON DELETE CASCADE,
  owner_id      uuid NOT NULL,
  -- Brain asset path when the uploaded bytes were persisted; null for paste-in / text-only refs.
  file_path     text,
  file_name     text NOT NULL,
  -- The readable text every conversation in the project can see (decoded for text files, OCR'd
  -- for images/PDF on upload).
  content_text  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_project_references_project_idx ON pa_project_references (project_id, created_at DESC);

-- ── 4. link conversations to projects ──────────────────────────────────────────
ALTER TABLE pocket_agent_conversations
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES pa_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS pocket_agent_conversations_project_idx
  ON pocket_agent_conversations (project_id, pinned DESC, updated_at DESC);

-- ── RLS (owner-scoped; service role bypasses) ───────────────────────────────────
ALTER TABLE pa_projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_project_memory     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_project_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_projects_owner_all ON pa_projects;
CREATE POLICY pa_projects_owner_all ON pa_projects
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS pa_project_memory_owner_all ON pa_project_memory;
CREATE POLICY pa_project_memory_owner_all ON pa_project_memory
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS pa_project_references_owner_all ON pa_project_references;
CREATE POLICY pa_project_references_owner_all ON pa_project_references
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
