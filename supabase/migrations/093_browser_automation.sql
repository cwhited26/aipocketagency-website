-- 093_browser_automation.sql — Browser Automation (Basic mode / hidden browser), Phase 1.
--
-- Pocket Agent gains a server-side Playwright tool catalog: each agent tool (browser_navigate,
-- browser_screenshot, browser_read_page, browser_click, browser_type, browser_extract_table,
-- browser_wait_for) drives a FRESH, isolated headless Chromium that PA spawns per task — never the
-- owner's own browser, no authenticated sessions cross over (that "connected mode" is a future lane).
-- This is the same risk profile as a web fetch, gated through Mission Control like every other write.
--
-- Two additive owner-scoped tables + one CHECK widen on pa_inbox_items.kind. Additive + idempotent.
-- RLS mirrors the Pocket Capture inbound tables (084 / 087 / 088): owner-scoped SELECT for the audit
-- log + permissions UI; every write goes through the service-role key from a route that resolves +
-- gates ownership first.
--
--   pa_browser_actions          — the audit trail AND the Trust-Ladder ledger. One row per attempted
--                                 tool call: who, which persona/task, the action, target URL + domain,
--                                 selector, the JSON result, the stored screenshot, status + error.
--                                 Every action — refused, blocked, staged, executed — writes a row, so
--                                 the log can never silently drop an attempt.
--   pa_browser_domain_permissions — per-(owner, domain) allow/deny + an auto_approve flag. The
--                                 permissions UI flips auto_approve on only after the Trust Ladder
--                                 unlocks (≥5 manually-approved executed actions for that domain).
--
-- Numbered 093: 082–089 are taken by the Meeting Persona + Pocket Capture lanes (085 skipped); 090
-- daily_logs, 091 Channels Gateway Telegram, 092 Persona Souls all landed on main while this lane built.

-- ── pa_browser_actions — per-action audit + Trust-Ladder ledger ─────────────────────────────────────
-- status lifecycle:
--   'refused'          — hit the hardcoded refuse list (forbidden domain / money-movement pattern). Never ran.
--   'blocked'          — over the tier's monthly cap, or the domain is explicitly denied. Never ran.
--   'pending_approval' — staged a browser_action_approval card; awaits the owner's tap. Not yet run.
--   'executed'         — ran successfully against the headless browser.
--   'rejected'         — the owner rejected the staged card. Never ran.
--   'failed'           — ran but the tool errored (navigation timeout, selector miss, etc.). error is set.
-- approved_manually is true on a row the owner approved by hand (vs. an auto-approved or refused row);
-- the Trust Ladder counts executed rows with approved_manually=true per domain.
CREATE TABLE IF NOT EXISTS pa_browser_actions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  persona_id        uuid,
  task_id           uuid,
  action            text NOT NULL,
  target_url        text,
  domain            text,
  selector          text,
  payload_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_json       jsonb,
  screenshot_url    text,
  status            text NOT NULL DEFAULT 'pending_approval'
                      CHECK (status IN ('refused', 'blocked', 'pending_approval', 'executed', 'rejected', 'failed')),
  approved_manually boolean NOT NULL DEFAULT false,
  error             text,
  inbox_item_id     uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- The log lists an owner's actions newest-first; the filter UI narrows by domain / persona / status.
CREATE INDEX IF NOT EXISTS pa_browser_actions_owner_idx
  ON pa_browser_actions (owner_id, created_at DESC);
-- The Trust Ladder counts manually-approved executed actions per (owner, domain) — index that lookup.
CREATE INDEX IF NOT EXISTS pa_browser_actions_owner_domain_idx
  ON pa_browser_actions (owner_id, domain);

COMMENT ON TABLE pa_browser_actions IS
  'Browser Automation (Phase 1) audit trail + Trust-Ladder ledger. One row per attempted browser_* tool call against the hidden headless browser. Service-role writes only; owner-scoped SELECT.';
COMMENT ON COLUMN pa_browser_actions.approved_manually IS
  'True when the owner approved this action by hand. The Trust Ladder counts executed rows with this true per domain (≥5 unlocks auto-approve).';
COMMENT ON COLUMN pa_browser_actions.domain IS
  'Registrable host of target_url (e.g. "quickbooks.com"), denormalized for the per-domain Trust Ladder + log filter.';

ALTER TABLE pa_browser_actions ENABLE ROW LEVEL SECURITY;

-- Owner reads their own action log. All writes are service-role only (the key bypasses RLS) — no
-- INSERT/UPDATE/DELETE policy is granted to clients.
DROP POLICY IF EXISTS pa_browser_actions_owner_select ON pa_browser_actions;
CREATE POLICY pa_browser_actions_owner_select
  ON pa_browser_actions
  FOR SELECT USING (owner_id = auth.uid());

-- ── pa_browser_domain_permissions — per-(owner, domain) allow/deny + auto-approve ───────────────────
-- decision is the owner's standing rule for a domain: 'allow' (PA may drive it) or 'deny' (never).
-- auto_approve flips the gate from "stage a card every time" to "run without asking" — the permissions
-- route only lets it turn on once the Trust Ladder has unlocked for that domain (≥5 manual approvals).
-- A domain with no row falls through to the default: allowed, but always card-gated.
CREATE TABLE IF NOT EXISTS pa_browser_domain_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  domain        text NOT NULL,
  decision      text NOT NULL DEFAULT 'allow' CHECK (decision IN ('allow', 'deny')),
  auto_approve  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, domain)
);

CREATE INDEX IF NOT EXISTS pa_browser_domain_permissions_owner_idx
  ON pa_browser_domain_permissions (owner_id, domain);

COMMENT ON TABLE pa_browser_domain_permissions IS
  'Browser Automation per-domain allow/deny + Trust-Ladder auto-approve flag. Owner-scoped SELECT; service-role writes only.';

ALTER TABLE pa_browser_domain_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_browser_domain_permissions_owner_select ON pa_browser_domain_permissions;
CREATE POLICY pa_browser_domain_permissions_owner_select
  ON pa_browser_domain_permissions
  FOR SELECT USING (owner_id = auth.uid());

-- ── pa_inbox_items.kind — admit browser_action_approval ──────────────────────────────────────────────
-- Every browser_* tool call that isn't auto-approved or refused stages a browser_action_approval card
-- in Mission Control (same commit-on-approve primitive as action_approval / build_action_approval; it
-- resolves through the same /api/orchestrator/approvals route + ActionApprovalCard). CHECK history: 012
-- ('draft','decision'); 014 'email_triage'; 016 'persona_lead'; 021 'action_approval'+'sub_agent_activity';
-- 023 'routine_output'; 044 'lead_scout_batch'; 046 'build_action_approval'; 057 'cost_budget_gate'; 059
-- 'skill_evolution_proposal'; 060 'gate_findings'; 063 'follow_up_sweep_batch'; 066 'capture_triage_proposal';
-- 072 'ritual_result'+'ritual_paused'; 073 'persona_memory_proposal'; 092 'soul_attribute_proposal'. We
-- recreate the constraint from the FULL set the application's InboxKind union declares and add
-- browser_action_approval. Additive only; every live kind is preserved (the 060 drop-two-kinds mistake
-- is not repeated) — soul_attribute_proposal from 092 is carried forward here.
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
    'soul_attribute_proposal',
    'browser_action_approval'
  ));
