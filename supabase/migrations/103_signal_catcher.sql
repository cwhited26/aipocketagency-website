-- 103_signal_catcher.sql (102 is held by the WhatsApp cold-onboarding sibling lane) — the Signal Catcher primitive (PA-SIGNAL-1, Positioning Lock §14.3).
--
-- Twin's last unanswered proactivity claim is "the dashboard you mentioned once." PA already
-- outships them on scheduled proactive work (Ritual Scheduler + Follow-Up Sweeps + LEARN); what
-- was missing is the catch: an offhand "I keep meaning to check my pipeline every Monday" in a
-- Persona chat, noticed and turned into a Ritual proposal the owner approves, edits, or rejects.
-- One cheap Haiku classification per owner chat message (Studio+/Enterprise only), one
-- signal_catcher_ritual_proposal card in Mission Control when a signal clears the owner's
-- sensitivity threshold. Approve creates a real pa_rituals row through the shipped Scheduler.
--
-- Additive only: two new tables + the pa_inbox_items.kind constraint recreated with the new kind.

-- ── 1 · pa_signal_catches — one row per caught signal ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_signal_catches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The persona_conversations row the signal came from. Nullable — future surfaces (WhatsApp
  -- cold-onboarding threads, PA-POS-32) may not have one.
  source_persona_chat_id UUID REFERENCES persona_conversations(id) ON DELETE SET NULL,
  -- The exact user message the classifier read (persona_messages, migration 015). SET NULL on
  -- delete — the verbatim quote below survives the message row.
  user_message_id UUID REFERENCES persona_messages(id) ON DELETE SET NULL,
  -- The owner's words, verbatim, shown back on the proposal card.
  quote TEXT NOT NULL,
  classified_signal_type TEXT NOT NULL
    CHECK (classified_signal_type IN ('recurring_task', 'dashboard', 'digest', 'notification')),
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  suggested_ritual_name TEXT NOT NULL,
  -- Natural language, parser-ready ("every Monday at 8am") — the Ritual Scheduler's parser is the
  -- one that turns it into cron on approve; the raw cron is never stored here.
  suggested_cadence TEXT NOT NULL,
  -- The App the proposed ritual would run (validated through resolveRitualTarget at propose time).
  suggested_app_slug TEXT NOT NULL,
  -- Normalized name key for the dedup windows (same-theme re-propose suppression).
  theme_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'deduped_already_ritualized')),
  -- The Mission Control card this catch staged (null when deduped before staging).
  inbox_item_id UUID REFERENCES pa_inbox_items(id) ON DELETE SET NULL,
  -- The pa_rituals row an approval created.
  ritual_id UUID REFERENCES pa_rituals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pa_signal_catches_owner
  ON pa_signal_catches (owner_id, created_at DESC);
-- The dedup lookups: same theme within a window, filtered by status.
CREATE INDEX IF NOT EXISTS idx_pa_signal_catches_theme
  ON pa_signal_catches (owner_id, theme_key, created_at DESC);

ALTER TABLE pa_signal_catches ENABLE ROW LEVEL SECURITY;

-- Owner reads their own catches; all writes go through the service role (same posture as
-- pa_inbox_items — the API routes are the real gate).
DROP POLICY IF EXISTS pa_signal_catches_owner_select ON pa_signal_catches;
CREATE POLICY pa_signal_catches_owner_select ON pa_signal_catches
  FOR SELECT USING (owner_id = auth.uid());

-- ── 2 · pa_signal_catcher_settings — the owner's toggle + sensitivity ───────────────────────────
-- Absence of a row means the defaults: ON for entitled tiers, medium sensitivity. Sensitivity maps
-- to the confidence threshold a signal must clear: low 0.85, medium 0.70, high 0.55.
CREATE TABLE IF NOT EXISTS pa_signal_catcher_settings (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sensitivity TEXT NOT NULL DEFAULT 'medium'
    CHECK (sensitivity IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pa_signal_catcher_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_signal_catcher_settings_owner_select ON pa_signal_catcher_settings;
CREATE POLICY pa_signal_catcher_settings_owner_select ON pa_signal_catcher_settings
  FOR SELECT USING (owner_id = auth.uid());

-- ── 3 · pa_inbox_items.kind — admit the signal_catcher_ritual_proposal card ─────────────────────
-- The proposal card: the owner's quote + the proposed Ritual (name, cadence, App) + Approve /
-- Edit / Reject. We recreate the constraint from the full live set (last touched in
-- 101_agent_builder.sql) and add the new kind. Additive only — every live kind is preserved.
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
    'website_alert',
    'agent_builder_proposal',
    'signal_catcher_ritual_proposal'
  ));
