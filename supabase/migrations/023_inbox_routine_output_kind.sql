-- 023_inbox_routine_output_kind.sql
-- Additive migration — widens the pa_inbox_items.kind CHECK to admit 'routine_output'.
--
-- Routine outputs (Daily Brief, Weekly Digest, Follow-up Sweep summaries) are
-- informational: an output, not an action. Nothing fires if the user doesn't tap,
-- so they must NOT render with Approve/Reject. Tagging them 'routine_output' lets
-- the Inbox card renderer give them informational affordances (Mark as read /
-- Save to brain / Dismiss) instead of lying about the primitive with an Approve.
--
-- CHECK history: 012 created ('draft','decision'); 014 added 'email_triage';
-- 016 added 'persona_lead'; 021 added 'action_approval' + 'sub_agent_activity'.
-- This migration is additive only — every existing kind is preserved.

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
    'routine_output'
  ));
