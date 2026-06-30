-- 095_website_monitor_and_proposals.sql — two new PA Apps: Website Monitoring + Proposal Generator.
--
-- Sourced from Skool Wave-2 intel (Cortex Month 3 "AI Employees" — Website Monitoring Agent +
-- Proposal & Document Agent), both confirmed gaps in the PA Apps catalog.
--
--   (1) Website Monitoring — the owner registers URLs to watch; a */5 cron polls the due ones
--       (HEAD + GET status + content hash + response time + SSL expiry) and stages a website_alert
--       Mission Control card when something changes (status drift, slow response, content drift on an
--       alert-on-change URL, or an SSL cert expiring inside the owner's threshold).
--
--   (2) Proposal Generator — the owner picks a Persona + writes a brief; the LLM drafts a structured
--       proposal (markdown + Puppeteer PDF) that the owner edits, then stages in the Approval Inbox to
--       send as a Gmail draft (PDF attached) or upload to a brain folder.
--
-- Additive + idempotent. Three new owner-scoped tables + one CHECK widen for the website_alert card.
-- No data movement, no existing-row changes.
--
-- NOTE on FK targets: the live schema uses personas(id) and auth.users(id) (see 073_persona_memory.sql
-- and 092_persona_souls.sql) — the same uuids the idealised data models name pa_personas /
-- pocket_agent_users. This migration references the real relations.

-- ── 1 · pa_monitored_websites — one row per watched URL ───────────────────────────────────────────
-- check_interval_seconds: how often the cron should poll this URL (5 / 15 / 60 / 360 minutes).
-- alert_on_status_change: fire when last_status crosses the 200↔non-200 boundary.
-- alert_on_content_change: fire when the GET body content hash drifts (treat the page as "alert-on-change").
-- alert_on_slow_response: fire when a check takes longer than the slow-response threshold (> 3s).
-- alert_on_ssl_expiry_days: fire when the TLS cert expires within this many days (0 disables the check).
-- last_*: the most recent observed state, written by the cron each tick (used for diffing + the surface).
-- is_active: paused URLs are skipped by the cron but kept (the owner's "Pause" action).
CREATE TABLE IF NOT EXISTS pa_monitored_websites (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                 uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  url                      text NOT NULL,
  check_interval_seconds   integer NOT NULL DEFAULT 900
                             CHECK (check_interval_seconds IN (300, 900, 3600, 21600)),
  alert_on_status_change   boolean NOT NULL DEFAULT true,
  alert_on_content_change  boolean NOT NULL DEFAULT false,
  alert_on_slow_response   boolean NOT NULL DEFAULT true,
  alert_on_ssl_expiry_days integer NOT NULL DEFAULT 14 CHECK (alert_on_ssl_expiry_days BETWEEN 0 AND 365),
  last_check_at            timestamptz,
  last_status              integer,
  last_response_ms         integer,
  last_content_hash        text,
  last_ssl_expires_at      timestamptz,
  is_active                boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- The cron sweeps active rows whose next check is due (last_check_at + interval <= now, or never checked).
CREATE INDEX IF NOT EXISTS pa_monitored_websites_due_idx
  ON pa_monitored_websites (last_check_at)
  WHERE is_active = true;
-- The surface lists a single owner's URLs newest-first.
CREATE INDEX IF NOT EXISTS pa_monitored_websites_owner_idx
  ON pa_monitored_websites (owner_id, created_at DESC);

ALTER TABLE pa_monitored_websites ENABLE ROW LEVEL SECURITY;

-- Owner-scoped SELECT (defense-in-depth on top of the route ownership gate). All writes go through the
-- service-role key from the cron + the API routes, which gate ownership before mutating.
DROP POLICY IF EXISTS pa_monitored_websites_owner_select ON pa_monitored_websites;
CREATE POLICY pa_monitored_websites_owner_select ON pa_monitored_websites
  FOR SELECT USING (owner_id = auth.uid());

-- ── 2 · pa_website_checks — append-only check history (powers the uptime sparkline) ──────────────
-- One row per poll tick. Kept lightweight: the surface reads the last N rows per website to draw the
-- uptime history sparkline and compute an uptime %. `ok` is the simple up/down signal (2xx/3xx + no
-- error); `status` is the raw HTTP status (null when the request errored before a response).
CREATE TABLE IF NOT EXISTS pa_website_checks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id   uuid NOT NULL REFERENCES pa_monitored_websites (id) ON DELETE CASCADE,
  owner_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  checked_at   timestamptz NOT NULL DEFAULT now(),
  ok           boolean NOT NULL,
  status       integer,
  response_ms  integer
);

-- The sparkline reads one website's most-recent checks oldest→newest after slicing the latest N.
CREATE INDEX IF NOT EXISTS pa_website_checks_website_idx
  ON pa_website_checks (website_id, checked_at DESC);

ALTER TABLE pa_website_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_website_checks_owner_select ON pa_website_checks;
CREATE POLICY pa_website_checks_owner_select ON pa_website_checks
  FOR SELECT USING (owner_id = auth.uid());

-- ── 3 · pa_proposals — one row per generated proposal ────────────────────────────────────────────
-- persona_id: the Persona whose voice + brain context drafted the proposal (default Sales Assistant).
-- brief: the owner's input (client name + scope + budget guidance + tone preference), stored as the
--   structured JSON the generator consumed (kept for re-generation + audit).
-- generated_markdown: the editable proposal body (the owner can edit before staging).
-- pdf_storage_url: the rendered PDF location (Supabase Storage path / signed URL), null until rendered.
-- status: draft → staged (in the Approval Inbox) → sent (Gmail draft created / uploaded to brain) ;
--   archived is the owner's "Archive" action. sent_at stamps the send.
CREATE TABLE IF NOT EXISTS pa_proposals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  persona_id          uuid REFERENCES personas (id) ON DELETE SET NULL,
  client_name         text NOT NULL,
  brief               jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_markdown  text NOT NULL DEFAULT '',
  pdf_storage_url     text,
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'staged', 'sent', 'archived')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  sent_at             timestamptz
);

-- The surface lists a single owner's proposals newest-first.
CREATE INDEX IF NOT EXISTS pa_proposals_owner_idx
  ON pa_proposals (owner_id, created_at DESC);

ALTER TABLE pa_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_proposals_owner_select ON pa_proposals;
CREATE POLICY pa_proposals_owner_select ON pa_proposals
  FOR SELECT USING (owner_id = auth.uid());

-- ── 4 · pa_inbox_items.kind — admit the website_alert card ───────────────────────────────────────
-- A status / slow-response / content-drift / SSL-expiry change stages one website_alert Mission Control
-- card the owner reviews. We recreate the constraint from the full live set (last touched in
-- 093_browser_automation.sql) and add the new kind. Additive only — every live kind is preserved.
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
    'browser_action_approval',
    'website_alert'
  ));
