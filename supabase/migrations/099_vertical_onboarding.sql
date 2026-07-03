-- 099_vertical_onboarding.sql — vertical-picker onboarding state (PA-POS-22).
--
-- The first stop after checkout / first login is now /app/onboarding/vertical: the owner picks
-- which of six verticals describes their business (coach / consultant / contractor / med-spa /
-- agency / sales-team) or skips. The pick drives what gets seeded into their workspace — three
-- role Personas from the shipped templates, the tier-unlocked Starter Skills pack, and the Apps
-- those Personas carry. Everything seeded lands in the OWNER's own brain repo (PA-POS-19), so
-- the actual Persona seeding is deferred until a brain is connected; this migration only stores
-- the decision and the seed bookkeeping.
--
-- Two additive changes, nothing destructive:
--   1. pocket_agent_users.vertical — the picked vertical slug. NULL = skipped ("Other / skip")
--      or picked before this shipped. The workspace anchor in this repo IS pocket_agent_users
--      (one row per owner; there is no separate workspaces table), so the column lives here.
--   2. pa_onboarding_state — one row per owner tracking the vertical decision + what the seeder
--      has landed so far. Split from pocket_agent_users because the seed bookkeeping
--      (seeded_persona_slugs) grows and re-runs; the user row stays a flat profile.
--
-- Seeding is idempotent and self-healing: ensureVerticalSeed (src/lib/onboarding/vertical-seed.ts)
-- re-runs on brain connect and on Home load, seeds only the missing delta (clamped by the tier's
-- persona cap), and stamps personas_seeded_at once every planned Persona exists. A starter-tier
-- owner (persona cap 0) keeps the vertical; an upgrade later completes the seed.

ALTER TABLE pocket_agent_users
  ADD COLUMN IF NOT EXISTS vertical text;

COMMENT ON COLUMN pocket_agent_users.vertical IS
  'PA-POS-22: the vertical the owner picked at onboarding (coach / consultant / contractor / med-spa / agency / sales-team). NULL = skipped or pre-dates the vertical picker. Drives workspace seeding via pa_onboarding_state.';

-- ── pa_onboarding_state — one row per owner: the vertical decision + seed bookkeeping ─────────────
CREATE TABLE IF NOT EXISTS pa_onboarding_state (
  owner_id              uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  vertical              text,
  vertical_picked_at    timestamptz,
  personas_seeded_at    timestamptz,
  seeded_persona_slugs  text[] NOT NULL DEFAULT '{}',
  suggested_app_ids     text[] NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE pa_onboarding_state IS
  'PA-POS-22: per-owner vertical-picker onboarding state. vertical_picked_at set means the owner decided (vertical NULL + picked_at set = explicit skip). The Persona seeder reads/writes the seed bookkeeping; service-role writes only.';

COMMENT ON COLUMN pa_onboarding_state.vertical IS
  'The picked vertical slug, mirrored onto pocket_agent_users.vertical. NULL with vertical_picked_at set = the owner chose "Other / skip".';
COMMENT ON COLUMN pa_onboarding_state.personas_seeded_at IS
  'Set once every Persona in the vertical''s seed plan exists. NULL while seeding is deferred (no brain yet) or clamped by the tier''s persona cap — the seeder re-runs and completes the delta.';
COMMENT ON COLUMN pa_onboarding_state.seeded_persona_slugs IS
  'Persona slugs this seeder created, so a re-run never duplicates and an owner-deleted Persona is not resurrected.';
COMMENT ON COLUMN pa_onboarding_state.suggested_app_ids IS
  'The Apps catalog ids suggested for the picked vertical (the union of the seeded templates'' defaultApps), recorded for the picker + Home surfaces.';

ALTER TABLE pa_onboarding_state ENABLE ROW LEVEL SECURITY;

-- Owner reads own row (the picker + Home surfaces render from it); every write goes through the
-- service-role key from the API routes, which resolve + gate ownership before writing.
DROP POLICY IF EXISTS pa_onboarding_state_owner_select ON pa_onboarding_state;
CREATE POLICY pa_onboarding_state_owner_select ON pa_onboarding_state
  FOR SELECT USING (owner_id = auth.uid());
