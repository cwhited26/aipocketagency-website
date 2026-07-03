-- 102_whatsapp_cold_onboarding.sql — WhatsApp cold-onboarding funnel (PA-POS-32, Positioning
-- Lock §22). Additive only.
--
-- pa_trial_threads: one row per cold WhatsApp sender texting PA's public number. The trial
-- workspace is this row — the composed Persona profile + the encrypted conversation state live
-- here until the owner converts (Stripe checkout with metadata.trial_thread_id) or the 14-day
-- TTL sweep expires the thread. sender_phone is the natural key (WhatsApp wa_id digits);
-- thread_id is the opaque handle that rides Stripe metadata and signed checkout links so the
-- raw phone number never leaves our database.
--
-- pa_moderation_events: the §22.4 content-classifier ledger. Every inbound the Haiku gate
-- flags lands here for review. Service-role surface only — no owner ever reads another
-- sender's messages.

CREATE TABLE IF NOT EXISTS pa_trial_threads (
  sender_phone TEXT PRIMARY KEY,
  -- Opaque handle for Stripe metadata + signed links (never the phone).
  thread_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  composed_persona_slug TEXT,
  composed_apps TEXT[] NOT NULL DEFAULT '{}',
  composed_skill_slugs TEXT[] NOT NULL DEFAULT '{}',
  -- AES-256-GCM envelope (v1.<iv>.<tag>.<ct>) over the conversation-state JSON — encrypted at
  -- rest per §22.2, so this is TEXT, not JSONB. NULLed by the TTL sweep on expiry.
  conversation_state TEXT,
  turn_count INT NOT NULL DEFAULT 0,
  -- Real actions Poc has delivered (drafts, summaries, lists). The value ask fires only at >= 3.
  actions_delivered INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'declined', 'converted', 'expired')),
  -- §22.4 per-sender rate limit: thread starts inside the rolling 24h window (max 3).
  starts_in_window INT NOT NULL DEFAULT 1,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- §22.4 cool-off: set to now()+7d when a converted-then-canceled owner's thread is closed.
  cooloff_until TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_to_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The 14-day TTL sweep scans unconverted threads by recency.
CREATE INDEX IF NOT EXISTS idx_pa_trial_threads_ttl
  ON pa_trial_threads (status, last_active_at);
CREATE INDEX IF NOT EXISTS idx_pa_trial_threads_owner
  ON pa_trial_threads (converted_to_owner_id)
  WHERE converted_to_owner_id IS NOT NULL;

ALTER TABLE pa_trial_threads ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: cold senders aren't auth users, so every read/write goes through the
-- service-role key inside the webhook / cron / Stripe surfaces. RLS-on with zero policies locks
-- the anon and authenticated roles out entirely.

CREATE TABLE IF NOT EXISTS pa_moderation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  sender_phone TEXT NOT NULL,
  -- The classifier's category for the flag (abusive, harassment, off_topic, spam, other).
  category TEXT NOT NULL,
  -- The flagged inbound body, kept verbatim for abuse review.
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_moderation_events_recent
  ON pa_moderation_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pa_moderation_events_sender
  ON pa_moderation_events (sender_phone, created_at DESC);

ALTER TABLE pa_moderation_events ENABLE ROW LEVEL SECURITY;
-- Service-role only, same reasoning as pa_trial_threads.
