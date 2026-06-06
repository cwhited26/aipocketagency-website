-- Personas + Team — Wave 2 (Modes B + C: public link + website widget).
-- Additive migration — widens existing CHECKs and adds new tables only. Never drops data.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL) via Supabase MCP after the
-- lane lands. Wave 2 ships behind the env flag PA_PERSONAS_PUBLIC_MODES_ENABLED — the
-- schema is harmless to apply early; the public/widget routes stay 503 until the flag is
-- set on Vercel.
--
-- Builds on 015_personas.sql. Threat model: Modes B+C are anonymous-traffic surfaces, so
-- this migration adds the server-side rate-limit, lead-capture, widget-config, and
-- monthly-cap-notification primitives the public/widget routes need. All new tables are
-- RLS owner-reads-own per the existing PA pattern (writes go through the service-role key
-- in server routes; anonymous visitors never hold a Supabase session).

-- ── 1. Widen the mode CHECKs to admit the two new sharing modes ──────────────────────
-- 015 created these inline CHECKs, auto-named <table>_<column>_check by Postgres.
ALTER TABLE personas DROP CONSTRAINT IF EXISTS personas_mode_check;
ALTER TABLE personas
  ADD CONSTRAINT personas_mode_check
  CHECK (mode IN ('internal_team', 'public_link', 'widget'));

ALTER TABLE persona_share_tokens DROP CONSTRAINT IF EXISTS persona_share_tokens_mode_check;
ALTER TABLE persona_share_tokens
  ADD CONSTRAINT persona_share_tokens_mode_check
  CHECK (mode IN ('internal_team', 'public_link', 'widget'));

-- ── 2. persona_rate_limits (public + widget windowing) ───────────────────────────────
-- One row per (persona, scope, dimension-key, window). Three independent counters:
--   ip_hour      → ip set, session_id '' — N messages per IP per rolling hour bucket
--   session_day  → session_id set, ip ''  — N messages per visitor session per day
--   persona_day  → ip '', session_id ''    — N messages per persona per day
--   blocked_hour → ip '', session_id ''    — abuse-defense block count per persona/hour
-- Unused dimensions use '' (not NULL) so they participate in the composite primary key.
CREATE TABLE IF NOT EXISTS persona_rate_limits (
  persona_id   UUID        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  scope        TEXT        NOT NULL
                 CHECK (scope IN ('ip_hour', 'session_day', 'persona_day', 'blocked_hour')),
  ip           TEXT        NOT NULL DEFAULT '',
  session_id   TEXT        NOT NULL DEFAULT '',
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 0,

  PRIMARY KEY (persona_id, scope, ip, session_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_persona_rate_limits_window
  ON persona_rate_limits (persona_id, scope, window_start);

ALTER TABLE persona_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_rate_limits_select_own" ON persona_rate_limits;
CREATE POLICY "persona_rate_limits_select_own" ON persona_rate_limits
  FOR SELECT USING (
    persona_id IN (SELECT id FROM personas WHERE business_id = auth.uid())
  );

-- Atomic increment-and-return for one counter window. SECURITY DEFINER so the
-- service-role caller upserts + reads the running count in one round trip with no
-- read-modify-write race (defeats the §3(g) concurrency bypass).
CREATE OR REPLACE FUNCTION persona_rate_limit_hit(
  p_persona_id   UUID,
  p_scope        TEXT,
  p_ip           TEXT,
  p_session      TEXT,
  p_window_start TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO persona_rate_limits (persona_id, scope, ip, session_id, window_start, count)
  VALUES (p_persona_id, p_scope, COALESCE(p_ip, ''), COALESCE(p_session, ''), p_window_start, 1)
  ON CONFLICT (persona_id, scope, ip, session_id, window_start)
  DO UPDATE SET count = persona_rate_limits.count + 1
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

-- ── 3. persona_leads (captured visitor contacts) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS persona_leads (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id       UUID        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  email            TEXT,
  phone            TEXT,
  name             TEXT,
  conversation_id  UUID        REFERENCES persona_conversations(id) ON DELETE SET NULL,
  source           TEXT        NOT NULL DEFAULT 'public_link'
                     CHECK (source IN ('public_link', 'widget', 'pre_chat_form')),
  status           TEXT        NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new', 'contacted', 'qualified', 'junk')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_leads_persona
  ON persona_leads (persona_id, created_at DESC);

ALTER TABLE persona_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_leads_select_own" ON persona_leads;
CREATE POLICY "persona_leads_select_own" ON persona_leads
  FOR SELECT USING (
    persona_id IN (SELECT id FROM personas WHERE business_id = auth.uid())
  );

-- ── 4. persona_widget_config (Mode C presentation + lead-capture + abuse config) ─────
CREATE TABLE IF NOT EXISTS persona_widget_config (
  persona_id          UUID        PRIMARY KEY REFERENCES personas(id) ON DELETE CASCADE,
  allowed_origins     TEXT[]      NOT NULL DEFAULT '{}',
  greeting_text       TEXT        NOT NULL DEFAULT 'Hi! How can I help you today?',
  bubble_color        TEXT        NOT NULL DEFAULT '#22d3ee',
  bubble_position     TEXT        NOT NULL DEFAULT 'bottom-right'
                        CHECK (bubble_position IN ('bottom-right', 'bottom-left')),
  lead_capture_timing TEXT        NOT NULL DEFAULT 'pre_chat'
                        CHECK (lead_capture_timing IN ('pre_chat', 'mid_conversation', 'post_conversation', 'off')),
  lead_capture_enabled BOOLEAN    NOT NULL DEFAULT true,
  off_topic_message   TEXT,
  badge_removed       BOOLEAN     NOT NULL DEFAULT false,  -- Studio tier white-label only
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE persona_widget_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_widget_config_select_own" ON persona_widget_config;
CREATE POLICY "persona_widget_config_select_own" ON persona_widget_config
  FOR SELECT USING (
    persona_id IN (SELECT id FROM personas WHERE business_id = auth.uid())
  );

-- ── 5. Monthly cap-notification bookkeeping (50% / 80% / 100% fire-once flags) ───────
ALTER TABLE persona_usage_monthly
  ADD COLUMN IF NOT EXISTS notified_50  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE persona_usage_monthly
  ADD COLUMN IF NOT EXISTS notified_80  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE persona_usage_monthly
  ADD COLUMN IF NOT EXISTS notified_100 BOOLEAN NOT NULL DEFAULT false;

-- Flips a threshold's notified flag exactly once and reports whether THIS call did it,
-- so the chat endpoint fires the owner email a single time per threshold per month even
-- under concurrent requests.
CREATE OR REPLACE FUNCTION mark_persona_cap_notified(
  p_persona_id UUID,
  p_month      TEXT,
  p_threshold  INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE persona_usage_monthly SET
    notified_50  = CASE WHEN p_threshold = 50  THEN TRUE ELSE notified_50  END,
    notified_80  = CASE WHEN p_threshold = 80  THEN TRUE ELSE notified_80  END,
    notified_100 = CASE WHEN p_threshold = 100 THEN TRUE ELSE notified_100 END
  WHERE persona_id = p_persona_id AND month = p_month
    AND ((p_threshold = 50  AND notified_50  = FALSE)
      OR (p_threshold = 80  AND notified_80  = FALSE)
      OR (p_threshold = 100 AND notified_100 = FALSE));
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- ── 6. pa_inbox_items: admit the persona_lead kind ───────────────────────────────────
-- 012 created the CHECK with ('draft','decision'); 014 widened it to add 'email_triage'.
-- Wave 2 routes captured leads into the owner's Inbox as kind='persona_lead'.
ALTER TABLE pa_inbox_items DROP CONSTRAINT IF EXISTS pa_inbox_items_kind_check;
ALTER TABLE pa_inbox_items
  ADD CONSTRAINT pa_inbox_items_kind_check
  CHECK (kind IN ('draft', 'decision', 'email_triage', 'persona_lead'));
