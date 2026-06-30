-- 092_persona_souls.sql — Persona Soul System (Pocket_Agent_Soul_System_SPEC_v1).
--
-- The Soul is the third Persona layer (Identity / Skills / Soul). Skills learn the WHAT (techniques);
-- the brain holds facts; the Soul learns the HOW — how to work with THIS specific owner: their
-- communication style, response preferences, conversational rhythm, boundaries, surface preferences,
-- the working dynamic, and affective signals. It is per-Persona, per-owner, owner-editable, and loads
-- into the Persona's OWN system prompt only (never a customer-facing surface).
--
-- Append-only with supersession (the same temporal chain PA's brain + persona-memory use): a belief is
-- never contradicted in place — a new row is inserted and the old row's superseded_by is pointed at it.
--
-- One new owner-scoped table + one CHECK widen for the new soul_attribute_proposal Inbox card.
-- Additive + idempotent. No data movement, no existing-row changes.
--
-- NOTE on FK targets: the SPEC's data model names pa_personas(id) / pocket_agent_users(id) as an
-- idealised shape. The live schema (see migration 073_persona_memory.sql) uses personas(id) and
-- auth.users(id) — the same uuids — so this migration references those real relations.

-- ── 1 · pa_persona_souls — the per-Persona Soul attribute rows ───────────────────────────────────
-- attribute_kind: which of the seven Soul dimensions this attribute belongs to.
-- attribute_summary: one plain-English line in the owner's voice (loads into the system prompt block).
-- attribute_body: longer detail / example / quote, or null.
-- confidence: 0..1. Below 0.5 the extractor discards; 0.5..0.8 stages a soul_attribute_proposal card
--   for owner approval; above 0.8 lands directly. The runtime read loads attributes with confidence
--   > 0.4 that are not superseded.
-- locked: exempt from decay (the owner's "Lock" action — SPEC §Owner controls).
-- superseded_by: when set, this row is no longer live (a newer attribute replaced it, or the owner
--   retired it via "Forget"). The active read + the per-Persona cap count live rows only.
CREATE TABLE IF NOT EXISTS pa_persona_souls (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id        uuid NOT NULL REFERENCES personas (id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  attribute_kind    text NOT NULL CHECK (attribute_kind IN (
                      'communication_style','response_preference','conversational_rhythm',
                      'boundary','surface_preference','working_dynamic','affective_signal')),
  attribute_summary text NOT NULL,
  attribute_body    text,
  confidence        numeric NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  source_session_id text,
  locked            boolean NOT NULL DEFAULT false,
  superseded_by     uuid REFERENCES pa_persona_souls (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- The runtime read + the per-Persona cap always filter to ONE persona's LIVE attributes
-- (superseded_by IS NULL) — that is the structural ContainmentGuard scope (a Sales Assistant's Soul
-- can never load into Admin Assistant context). Index that exact read.
CREATE INDEX IF NOT EXISTS pa_persona_souls_live_idx
  ON pa_persona_souls (persona_id)
  WHERE superseded_by IS NULL;

-- The owner-facing page reads by (persona_id, owner_id); the supersession merge reads by kind.
CREATE INDEX IF NOT EXISTS pa_persona_souls_persona_owner_idx
  ON pa_persona_souls (persona_id, owner_id);
CREATE INDEX IF NOT EXISTS pa_persona_souls_kind_idx
  ON pa_persona_souls (attribute_kind)
  WHERE superseded_by IS NULL;

ALTER TABLE pa_persona_souls ENABLE ROW LEVEL SECURITY;

-- Owner-scoped SELECT for the Soul page (defense-in-depth on top of the route ownership gate). All
-- writes go through the service-role key from the extractor + the API routes, which gate ownership
-- before mutating — mirrors pa_persona_memory.
DROP POLICY IF EXISTS pa_persona_souls_owner_select ON pa_persona_souls;
CREATE POLICY pa_persona_souls_owner_select ON pa_persona_souls
  FOR SELECT USING (owner_id = auth.uid());

-- ── 2 · pa_inbox_items.kind — admit the soul_attribute_proposal card ──────────────────────────────
-- A mid-confidence (0.5..0.8) Soul observation stages one soul_attribute_proposal card: the proposed
-- {kind, summary, body, confidence} for one Persona, which the owner approves / edits / rejects the
-- same way as a persona_memory_proposal or a Skill evolution proposal. We recreate the constraint from
-- the full live set (last touched in 073_persona_memory.sql) and add the new kind. Additive only —
-- every live kind is preserved (the lesson from 060, which dropped kinds silently).
ALTER TABLE pa_inbox_items DROP CONSTRAINT IF EXISTS pa_inbox_items_kind_check;
ALTER TABLE pa_inbox_items
  ADD CONSTRAINT pa_inbox_items_kind_check
  CHECK (kind IN (
    'draft',
    'decision',
    'email_triage',
    'persona_lead',
    'action_approval',
    'sub_agent_activity',
    'routine_output',
    'lead_scout_batch',
    'build_action_approval',
    'cost_budget_gate',
    'skill_evolution_proposal',
    'gate_findings',
    'follow_up_sweep_batch',
    'capture_triage_proposal',
    'ritual_result',
    'ritual_paused',
    'persona_memory_proposal',
    'soul_attribute_proposal'
  ));
