-- 071_idea_engine.sql — Idea Engine App (PA-IDEA-1..7).
--
-- The Idea Engine chains six already-shipped PA primitives — Capture Inbox → Lead Scout (market
-- validation) → Project Scaffolding (blueprint) → Email Drafter / Build Tools (build) → Landing Page
-- Builder (sales surface) → Lead Scout outreach (launch) — into one staged workflow that turns a
-- dropped idea into a shipped MVP on the owner's own GitHub + Vercel. No new infrastructure (PA-IDEA-1):
-- this migration adds only the two owner-scoped state tables that track an idea and its per-stage runs.
--
-- RLS mirrors the Lead Scout / Follow-Up Sweeps / Capture Inbox / Starter Skills tables
-- (044 / 063 / 066 / 070): owner-scoped SELECT for the App surfaces; every write goes through the
-- service-role key (the engine runs in owner-gated API routes and, for re-runs, the cron path).
-- Additive + idempotent; no existing table is touched.

-- ── 1 · pa_ideas — one row per idea the owner drops into the engine ───────────────────────────────
-- `slug` is the owner-scoped, URL-safe identifier the drill-down page keys on, derived from the title
-- plus a short id suffix so two same-titled ideas don't collide. `source` records how it was captured
-- (typed text, a voice memo, or a shared link), with the raw capture payload in `source_payload`.
-- `current_stage` (1..6) is the furthest stage reached; `status` tracks the idea's lifecycle. Every
-- stage writes a Snapshot folder at brain/ideas/<slug>/ — `snapshot_brain_path` is the folder root so
-- the surface can deep-link into the owner's brain.
CREATE TABLE IF NOT EXISTS pa_ideas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  slug                 text NOT NULL,
  title                text NOT NULL,
  source               text NOT NULL DEFAULT 'typed'
                         CHECK (source IN ('typed', 'voice', 'share')),
  source_payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_stage        integer NOT NULL DEFAULT 1
                         CHECK (current_stage BETWEEN 1 AND 6),
  status               text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'archived', 'forked')),
  snapshot_brain_path  text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);

CREATE INDEX IF NOT EXISTS pa_ideas_owner_idx
  ON pa_ideas (owner_id, updated_at DESC);

ALTER TABLE pa_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_ideas_owner_select ON pa_ideas;
CREATE POLICY pa_ideas_owner_select ON pa_ideas
  FOR SELECT USING (owner_id = auth.uid());

-- ── 2 · pa_idea_stage_runs — one row per (idea, stage) execution ──────────────────────────────────
-- The per-stage state machine. `stage` is 1..6; `status` walks queued → running → (staged) →
-- approved/rejected → complete. `staged` is the pause where the owner approves in Mission Control
-- before the next stage fires (the blueprint plan, each build step). `output` carries the stage's
-- structured result (market scan + prospects, the scaffold, the prompt pack, build artifacts, the
-- outreach batch) so re-running a stage is self-contained and the drill-down can render each output.
-- A UNIQUE(idea_id, stage) is deliberately NOT imposed: re-running a stage inserts a fresh run row so
-- the history is preserved; the surface reads the latest run per stage.
CREATE TABLE IF NOT EXISTS pa_idea_stage_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id       uuid NOT NULL REFERENCES pa_ideas (id) ON DELETE CASCADE,
  owner_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stage         integer NOT NULL CHECK (stage BETWEEN 1 AND 6),
  status        text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'staged', 'approved', 'rejected', 'complete', 'error')),
  output        jsonb NOT NULL DEFAULT '{}'::jsonb,
  error         text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_idea_stage_runs_idea_idx
  ON pa_idea_stage_runs (idea_id, stage, created_at DESC);
CREATE INDEX IF NOT EXISTS pa_idea_stage_runs_owner_idx
  ON pa_idea_stage_runs (owner_id);

ALTER TABLE pa_idea_stage_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_idea_stage_runs_owner_select ON pa_idea_stage_runs;
CREATE POLICY pa_idea_stage_runs_owner_select ON pa_idea_stage_runs
  FOR SELECT USING (owner_id = auth.uid());
