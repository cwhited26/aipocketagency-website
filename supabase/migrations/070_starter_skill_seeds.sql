-- 070_starter_skill_seeds.sql — Starter Skills pack (PA-STARTERSKILL-1..6).
--
-- The 30 starter Skills (the AI Office Launch Kit bonus) are static config in the repo
-- (src/data/starter-skills). On a paid subscription they're seeded into the owner's brain repo as
-- skills/<slug>/SKILL.md. This migration adds the two owner-scoped tables that back the seeder + the
-- per-skill disable override. Additive + idempotent; no existing table is touched.
--
-- RLS mirrors the Lead Scout / Follow-Up Sweeps / Capture Inbox tables (044 / 063 / 066): owner-scoped
-- SELECT for the app surfaces; all writes go through the service-role key (the seeder runs in the
-- Stripe webhook with no session; the disable toggle runs in an owner-gated API route).

-- ── 1 · pa_starter_skill_seeds — audit of which starter skill was seeded into which owner ─────────
-- One row per (owner, skill) actually copied into the brain. UNIQUE(owner_id, skill_slug) makes a
-- re-seed idempotent (a webhook retry, or an upgrade re-run that only adds the newly-unlocked skills).
-- source_version stamps which starter-pack version was seeded ("v1"), so a future pack bump is auditable.
CREATE TABLE IF NOT EXISTS pa_starter_skill_seeds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  skill_slug      text NOT NULL,
  source_version  text NOT NULL DEFAULT 'v1',
  seeded_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, skill_slug)
);

CREATE INDEX IF NOT EXISTS pa_starter_skill_seeds_owner_idx
  ON pa_starter_skill_seeds (owner_id);

ALTER TABLE pa_starter_skill_seeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_starter_skill_seeds_owner_select ON pa_starter_skill_seeds;
CREATE POLICY pa_starter_skill_seeds_owner_select ON pa_starter_skill_seeds
  FOR SELECT USING (owner_id = auth.uid());

-- ── 2 · pa_skill_overrides — per-owner per-skill overrides ────────────────────────────────────────
-- v1 carries `disabled` (PA-STARTERSKILL-6): the owner turns a skill off so the dispatcher stops
-- loading it before planning, without deleting the brain file. UNIQUE(owner_id, skill_slug) → the
-- toggle is an idempotent upsert. Keyed on slug (not just starter slugs) so an owner can also disable
-- an owner-evolved Skill later without a schema change.
CREATE TABLE IF NOT EXISTS pa_skill_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  skill_slug  text NOT NULL,
  disabled    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, skill_slug)
);

-- The dispatcher reads an owner's disabled slugs on every run that resolves Skills — index that read.
CREATE INDEX IF NOT EXISTS pa_skill_overrides_owner_disabled_idx
  ON pa_skill_overrides (owner_id)
  WHERE disabled;

ALTER TABLE pa_skill_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_skill_overrides_owner_select ON pa_skill_overrides;
CREATE POLICY pa_skill_overrides_owner_select ON pa_skill_overrides
  FOR SELECT USING (owner_id = auth.uid());
