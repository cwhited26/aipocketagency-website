-- 073_persona_memory.sql — Persona Memory Partitions (PA-MEM-1..7).
--
-- Each Persona gets a memory layer ON TOP of the global brain: five partitions
-- (working / episodic / semantic / procedural / model_of_you) × three tiers
-- (session / persona / global). A write declares its tier; reads cascade
-- global → persona → session. Append-only with supersession (the same temporal
-- chain PA's brain memory uses) — nothing is mutated in place, a memory is
-- replaced by pointing the old row's superseded_by at the new one.
--
-- The brain repo stays the source of truth for documents the owner authored;
-- pa_persona_memory is the Persona's accumulated context layer, not a doc store.
--
-- One new owner-scoped table + one CHECK widen for the new persona_memory_proposal
-- Inbox card. Additive + idempotent. No data movement, no existing-row changes.

-- ── 1 · pa_persona_memory — the per-Persona memory rows ───────────────────────────────────────────
-- partition: which of the five cognitive partitions this memory belongs to.
-- tier:      its scope. 'session' lives only in one conversation (conversation_id required);
--            'persona' lives across this Persona's conversations; 'global' across every Persona.
-- importance: 1..10. Writes at >= 8 auto-fire on a trusted origin; below that they stage a
--            persona_memory_proposal Inbox card for owner approval.
-- superseded_by: when set, this row is no longer live (a newer memory replaced it). The tier cap
--            counts live rows only; superseded rows never count and never read.
-- untrusted_origin: true when the memory was written off a share_extension capture — the trust bar.
--            An untrusted-origin write never auto-fires; it always stages for owner approval.
CREATE TABLE IF NOT EXISTS pa_persona_memory (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  persona_id        uuid NOT NULL REFERENCES personas (id) ON DELETE CASCADE,
  partition         text NOT NULL CHECK (partition IN ('working','episodic','semantic','procedural','model_of_you')),
  tier              text NOT NULL CHECK (tier IN ('session','persona','global')),
  conversation_id   uuid,
  body              text NOT NULL,
  importance        smallint NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  contact_ref       text,
  untrusted_origin  boolean NOT NULL DEFAULT false,
  source_event_id   uuid,
  superseded_by     uuid REFERENCES pa_persona_memory (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_read_at      timestamptz,
  -- A session-tier memory is meaningless without the conversation it belongs to.
  CONSTRAINT pa_persona_memory_session_has_convo
    CHECK (tier <> 'session' OR conversation_id IS NOT NULL)
);

-- The read path always filters to ONE persona's LIVE memories (superseded_by IS NULL) — that is the
-- structural ContainmentGuard scope (a Sales Assistant write can never load into Admin Assistant
-- context). Index that exact read.
CREATE INDEX IF NOT EXISTS pa_persona_memory_live_idx
  ON pa_persona_memory (persona_id, partition)
  WHERE superseded_by IS NULL;

-- The tier cap counts an owner's live memories across all their Personas (SPEC §9). Index that count.
CREATE INDEX IF NOT EXISTS pa_persona_memory_owner_live_idx
  ON pa_persona_memory (owner_id)
  WHERE superseded_by IS NULL;

-- The "Forget everything about [Contact]" filter reads by persona + contact_ref.
CREATE INDEX IF NOT EXISTS pa_persona_memory_contact_idx
  ON pa_persona_memory (persona_id, contact_ref)
  WHERE contact_ref IS NOT NULL AND superseded_by IS NULL;

ALTER TABLE pa_persona_memory ENABLE ROW LEVEL SECURITY;

-- Owner-scoped SELECT for the inspector surface (defense-in-depth on top of the route ownership
-- gate). All writes go through the service-role key from the LEARN write path and the API routes,
-- which gate ownership before mutating — mirrors the Lead Scout / Capture Inbox tables.
DROP POLICY IF EXISTS pa_persona_memory_owner_select ON pa_persona_memory;
CREATE POLICY pa_persona_memory_owner_select ON pa_persona_memory
  FOR SELECT USING (owner_id = auth.uid());

-- ── 2 · pa_inbox_items.kind — admit the persona_memory_proposal card ──────────────────────────────
-- The LEARN write path stages one persona_memory_proposal per below-threshold memory write (PA-MEM-3):
-- the proposed {partition, tier, body, importance}, which the owner approves / edits / rejects the same
-- way as a Skill evolution proposal. CHECK history: 012 ('draft','decision'); 014 'email_triage';
-- 016 'persona_lead'; 021 'action_approval'+'sub_agent_activity'; 023 'routine_output';
-- 044 'lead_scout_batch'; 046 'build_action_approval'; 057 'cost_budget_gate';
-- 059 'skill_evolution_proposal'; 060 'gate_findings'; 063 'follow_up_sweep_batch';
-- 066 'capture_triage_proposal'. The Ritual Scheduler lane adds 'ritual_result'+'ritual_paused' in its
-- own migration — we include them here too so the order the two migrations land in can't drop either
-- (a CHECK that allows an unused kind is harmless; a CHECK that omits a live one is not). We recreate
-- the constraint from the full set and add 'persona_memory_proposal'. Additive only; every live kind
-- is preserved (the lesson from 060, which dropped kinds silently).
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
    'persona_memory_proposal'
  ));
