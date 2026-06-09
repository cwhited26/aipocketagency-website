-- 062_personas_apps.sql — Personas Wave 2 launch: declare each Persona's Apps.
--
-- Positioning lock (PA-PERSONA-29): a Persona is the WHO (Admin Assistant, Sales
-- Assistant, Content Creator…); an App is the WHAT it uses (Email Drafter, Follow-up
-- Radar, Lead Scout…). Each persona now declares which Apps it is set up to use. App ids
-- are the stable keys from the application-side Apps catalog (src/lib/apps/catalog.ts),
-- stored as a text[] so the set is queryable and the create/edit flows can read it back.
--
-- Additive + idempotent. RLS is unchanged — this is a new column on the existing
-- `personas` table, already owner-scoped by the migration-015 policies.

alter table public.personas
  add column if not exists accessible_apps text[] not null default '{}'::text[];

comment on column public.personas.accessible_apps is
  'Stable App ids (src/lib/apps/catalog.ts) this persona is set up to use. PA-PERSONA-29: Personas = WHO, Apps = WHAT.';
