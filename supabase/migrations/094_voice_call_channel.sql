-- 094_voice_call_channel.sql — Channels Gateway Phase 6: Voice Call (Twilio + ElevenLabs + Whisper).
--
-- A real phone number per owner that, when called, hands to that owner's default Persona. The Persona
-- answers in its configured ElevenLabs voice, the caller talks, Whisper transcribes, PA's existing
-- approval+action plumbing dispatches, and the response streams back as voice — looping until hangup.
-- Full spec: APA/Products/Pocket_Agent_Voice_Call_Channel_SPEC_v1.md (Phase 6).
--
-- Ships behind the PA_VOICE_CALL_ENABLED feature flag (default OFF). Additive + idempotent — no
-- column is dropped, no existing row is touched.
--
-- THREE changes:
--   1. pa_channel_connections.channel_slug — NO CHECK to widen. The column is plain `text NOT NULL`
--      (see 074_channels_gateway.sql §10: "No CHECK widen needed"); 'voice' is already an accepted
--      value at the DB layer. The closed set lives in code (src/lib/channels/types.ts CHANNEL_SLUGS),
--      where 'voice' is added this lane. A voice connection stores: external_id = the Twilio DID
--      (E.164), auth_token_encrypted = the Twilio Auth Token (AES-256-GCM via lib/crypto/encrypt.ts),
--      and config jsonb = { account_sid, voice_id, greeting, hangup_phrase, max_call_seconds, pool }.
--   2. personas.voice_profile_json — the per-Persona voice profile (speaking style, addressing,
--      quip cap, ElevenLabs voice id, greeting/farewell). Nullable, defaults to {} so every existing
--      Persona keeps working with a neutral default voice + style.
--   3. pa_voice_calls — one row per call: the audit + cost-reconciliation + minute-usage record.
--
-- RLS mirrors the channels pattern (074): owner-scoped SELECT for the settings surface + usage chart;
-- every write goes through the service-role key from the status webhook + stream loop (which verify
-- the Twilio signature and resolve ownership before mutating).

-- ── 2. personas.voice_profile_json ──────────────────────────────────────────────────────────────
-- The dispatcher reads this to inject speaking_style + addressing + the persona-quip cap into the
-- system prompt for every voice turn. Shape (all keys optional; src/lib/channels/voice/profile.ts
-- parses + defaults): { elevenlabs_voice_id, speaking_style, addressing, max_persona_quips_per_call,
-- greeting, farewell, fallback_voice_id }.
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS voice_profile_json jsonb DEFAULT '{}'::jsonb;

-- ── 3. pa_voice_calls ─────────────────────────────────────────────────────────────────────────
-- owner_id references auth.users(id) to match the Channels Gateway convention (pa_channel_connections
-- in 074 and personas in 015 both reference auth.users(id); PA is one-business-per-user, so
-- auth.users.id == pocket_agent_users.id == personas.business_id — the id the spec calls
-- "pocket_agent_users(id)"). persona_id references personas(id), the real Personas table (the spec's
-- "pa_personas").
CREATE TABLE IF NOT EXISTS pa_voice_calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- The Persona that answered this call. NULL = the gateway default Persona / no Persona resolved.
  persona_id       uuid REFERENCES personas (id) ON DELETE SET NULL,
  -- The Twilio CallSid — the idempotency key the status webhook + stream loop dedup on.
  twilio_call_sid  text NOT NULL UNIQUE,
  from_number      text NOT NULL,
  to_number        text NOT NULL,
  direction        text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  duration_seconds integer,
  -- Transcript only — PA does NOT record audio (spec §approval-gate 4). NULL until the call ends.
  transcript_full  text,
  -- Realized total cost of the call in CENTS (the per-segment breakdown lives in the matching
  -- pa_cost_events row's metadata.cost_breakdown). NUMERIC so sub-cent calls stay lossless.
  cost_cents       numeric,
  status           text NOT NULL CHECK (status IN ('ringing', 'in_progress', 'completed', 'failed', 'no_answer')),
  hangup_reason    text,
  -- PA-CHAN-5: a voice call is untrusted inbound content; the dispatcher flags the run so the Gate
  -- Phase applies hardened gates and writes stage as approval cards. Default true (always, for now).
  untrusted_origin boolean DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- The usage chart + monthly/daily minute-cap queries read an owner's calls newest-first within a
-- time window.
CREATE INDEX IF NOT EXISTS pa_voice_calls_owner_started_idx
  ON pa_voice_calls (owner_id, started_at DESC);

ALTER TABLE pa_voice_calls ENABLE ROW LEVEL SECURITY;

-- Owner-scoped SELECT only. No INSERT/UPDATE/DELETE policy → the service role bypasses RLS to write
-- (status webhook + stream loop), and the absence of write policies denies every other role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pa_voice_calls' AND policyname = 'pa_voice_calls_owner_read'
  ) THEN
    CREATE POLICY pa_voice_calls_owner_read ON pa_voice_calls
      FOR SELECT USING (owner_id = auth.uid());
  END IF;
END $$;
