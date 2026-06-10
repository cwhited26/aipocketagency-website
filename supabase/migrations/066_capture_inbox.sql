-- 066_capture_inbox.sql — Capture Inbox App (PA-CAPTURE-1..6).
--
-- The Capture Inbox is the App that bundles three behaviors over the share-extension capture flow:
--   1. Auto-routing rules — owner-authored, deterministic rules that file a shared item straight into
--      a dedicated brain path instead of leaving it in memory/inbox.md.
--   2. Triage helper — a Monday-morning sweep that reads the still-unfiled inbox entries, classifies
--      each with a cheap Haiku call, and stages a capture_triage_proposal card the owner approves.
--   3. Cleanup pass — once an entry has been folded into a dedicated brain note (by a rule, by an
--      approved triage proposal, or by the YouTube/Podcast ingester), it is pruned from inbox.md.
--
-- One new owner-scoped table + one CHECK widen. Additive + idempotent. RLS mirrors the Lead Scout
-- and Follow-Up Sweeps tables (migrations 044 / 063): owner-scoped SELECT for the settings surface;
-- all writes go through the service-role key from the cron and the API routes (which gate ownership
-- before mutating).

-- ── 1 · pa_capture_routing_rules — the owner's deterministic routing rules ───────────────────────
-- One row per rule. match_pattern carries the per-rule conditions (keywords / regex / a substring of
-- the source URL / a content type); a rule matches only when every condition it specifies matches.
-- target_path is the dedicated brain path the matched item is filed into (a directory → a new dated
-- note; a path ending in .md → appended to that file). priority orders evaluation: higher priority is
-- tried first, and the first matching rule wins.
CREATE TABLE IF NOT EXISTS pa_capture_routing_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  match_pattern  jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_path    text NOT NULL,
  enabled        boolean NOT NULL DEFAULT true,
  priority       integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_capture_routing_rules_owner_idx
  ON pa_capture_routing_rules (owner_id);
-- The share endpoint evaluates an owner's enabled rules in priority order on every capture — index
-- that exact read (owner_id, then priority high→low).
CREATE INDEX IF NOT EXISTS pa_capture_routing_rules_eval_idx
  ON pa_capture_routing_rules (owner_id, priority DESC)
  WHERE enabled;

ALTER TABLE pa_capture_routing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_capture_routing_rules_owner_select ON pa_capture_routing_rules;
CREATE POLICY pa_capture_routing_rules_owner_select ON pa_capture_routing_rules
  FOR SELECT USING (owner_id = auth.uid());

-- ── 2 · pa_inbox_items.kind — admit the capture_triage_proposal card ─────────────────────────────
-- The Monday triage sweep stages one capture_triage_proposal per still-unfiled inbox entry (PA-CAPTURE-2):
-- the suggested bucket + target path, which the owner approves / rejects / edits. CHECK history: 012
-- ('draft','decision'); 014 'email_triage'; 016 'persona_lead'; 021 'action_approval'+'sub_agent_activity';
-- 023 'routine_output'; 044 'lead_scout_batch'; 046 'build_action_approval'; 057 'cost_budget_gate';
-- 059 'skill_evolution_proposal'; 060 'gate_findings'; 063 'follow_up_sweep_batch'. We recreate the
-- constraint from the full set the application's InboxKind union declares and add 'capture_triage_proposal'.
-- Additive only; every live kind is preserved.
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
    'capture_triage_proposal'
  ));
