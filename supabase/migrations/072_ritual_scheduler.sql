-- 072_ritual_scheduler.sql — Ritual Scheduler App (PA-RITUAL-1..8).
--
-- The Ritual Scheduler is the App that lets the owner author his own recurring work in one place,
-- instead of every recurring workflow being a developer-hard-coded cron. A ritual is (when, what,
-- deliver): a natural-language schedule the owner types (parsed to cron, never exposed as raw cron),
-- a target (one shipped App + its payload, or a saved Project Plan), and where the result lands (a
-- Mission Control card by default, or an email digest). A `*/5` sweep cron fires the due rituals.
--
-- Two new owner-scoped tables + one CHECK widen on pa_inbox_items.kind. Additive + idempotent. RLS
-- mirrors the Follow-Up Sweeps / Capture Inbox tables (migrations 063 / 066): owner-scoped SELECT for
-- the App surface; all writes go through the service-role key from the cron and the API routes (which
-- gate ownership before mutating).

-- ── 1 · pa_rituals — the owner's authored recurring jobs (SPEC §5) ───────────────────────────────
-- One row per ritual. Exactly one of app_slug / project_plan_id is set: app_slug fires a shipped App
-- with app_payload; project_plan_id fires a saved Project Plan via the sub-agent runner. project_plan_id
-- is a plain uuid (NOT a foreign key) — the pa_project_plans table isn't part of this lane's schema yet,
-- so a FK would fail to apply; the run executor only dispatches app_slug rituals in v1 and treats a
-- plan-only ritual as not-yet-runnable. schedule_natural_text preserves the owner's typed phrase verbatim
-- so the UI shows what he typed, not the cron. bi_weekly_skip carries the one non-standard cron case
-- ("every other Wednesday") the sweep resolves against last_run_at (SPEC §7).
CREATE TABLE IF NOT EXISTS pa_rituals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name                  text NOT NULL,
  app_slug              text,
  app_payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  project_plan_id       uuid,
  schedule_cron         text NOT NULL,
  schedule_natural_text text NOT NULL,
  bi_weekly_skip        boolean NOT NULL DEFAULT false,
  delivery              text NOT NULL DEFAULT 'inbox' CHECK (delivery IN ('inbox', 'email_digest')),
  enabled               boolean NOT NULL DEFAULT true,
  next_run_at           timestamptz NOT NULL DEFAULT now(),
  last_run_at           timestamptz,
  last_run_status       text CHECK (last_run_status IN ('success', 'failed')),
  consecutive_failures  smallint NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- A ritual must target exactly one of: a shipped App, or a saved Project Plan.
  CONSTRAINT pa_rituals_one_target CHECK (
    (app_slug IS NOT NULL AND project_plan_id IS NULL)
    OR (app_slug IS NULL AND project_plan_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS pa_rituals_owner_idx ON pa_rituals (owner_id);
-- The `*/5` cron sweeps enabled rituals whose next_run_at is due — index that exact predicate
-- (same next-run polling shape as Podcast Watch / Follow-Up Sweeps).
CREATE INDEX IF NOT EXISTS pa_rituals_due_idx ON pa_rituals (next_run_at) WHERE enabled;

ALTER TABLE pa_rituals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_rituals_owner_select ON pa_rituals;
CREATE POLICY pa_rituals_owner_select ON pa_rituals
  FOR SELECT USING (owner_id = auth.uid());

-- ── 2 · pa_ritual_runs — the per-fire run log (SPEC §5) ──────────────────────────────────────────
-- One row per ritual fire. Written 'running' at start, updated to 'success' / 'failed' on finish.
-- result_card_id points at the Mission Control card the run staged. cost_micro_cents rolls up the
-- run's realized cost (the wrapped App tags its own pa_cost_events under featureSlug 'ritual:<id>';
-- this column is the per-run roll-up for the detail page — SPEC §8). No owner_id column (SPEC §5);
-- ownership is reached through the parent ritual, which the RLS policy below joins.
CREATE TABLE IF NOT EXISTS pa_ritual_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id        uuid NOT NULL REFERENCES pa_rituals (id) ON DELETE CASCADE,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  status           text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  result_card_id   uuid,
  error_text       text,
  cost_micro_cents bigint NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_ritual_runs_ritual_idx ON pa_ritual_runs (ritual_id, started_at DESC);

ALTER TABLE pa_ritual_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_ritual_runs_owner_select ON pa_ritual_runs;
-- A run is visible to the owner of its parent ritual. The App reads runs through the service-role key;
-- this policy is defense-in-depth for any direct client read.
CREATE POLICY pa_ritual_runs_owner_select ON pa_ritual_runs
  FOR SELECT USING (
    ritual_id IN (SELECT id FROM pa_rituals WHERE owner_id = auth.uid())
  );

-- ── 3 · pa_inbox_items.kind — admit ritual_result + ritual_paused ────────────────────────────────
-- A ritual fire stages a ritual_result card (the run's output, read like routine_output / the sweep
-- batch cards). At 5 consecutive failures the ritual auto-pauses and stages a ritual_paused card
-- flagging the issue (PA-RITUAL-6). CHECK history: 012 ('draft','decision'); 014 'email_triage'; 016
-- 'persona_lead'; 021 'action_approval'+'sub_agent_activity'; 023 'routine_output'; 044
-- 'lead_scout_batch'; 046 'build_action_approval'; 057 'cost_budget_gate'; 059 'skill_evolution_proposal';
-- 060 'gate_findings'; 063 'follow_up_sweep_batch'; 066 'capture_triage_proposal'. We recreate the
-- constraint from the FULL set the application's InboxKind union declares and add the two ritual kinds.
-- Additive only; every live kind is preserved (the 060 drop-two-kinds mistake is not repeated).
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
    'ritual_paused'
  ));
