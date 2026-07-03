-- 104_voice_realtime_v2.sql — Voice v2 (PA-CHAN-15/16): the realtime bidirectional voice channel.
--
-- Phase 6 v0.1 (094, flag OFF) shipped the batch pipeline: Whisper STT → dispatcher → ElevenLabs
-- TTS, inbound only. v2 replaces the pipeline engine with an OpenAI Realtime bridge (bidirectional
-- audio over the same Twilio Media Stream transport), adds OUTBOUND calls (Poc calls someone on the
-- owner's behalf), and gives voice a real ChannelAdapter. Full spec: Channels Gateway SPEC §13
-- (Voice v2) + Pocket_Agent_Voice_Call_Channel_SPEC_v1.md.
--
-- Additive + idempotent. No column dropped, no row touched, 094's CHECK constraints untouched —
-- v2 code maps its 'active' UI status onto 094's 'in_progress' value.
--
-- TWO changes:
--   1. pa_voice_calls — four new nullable columns for the v2 engine.
--   2. pa_voice_call_events — the append-only per-call event ledger (speech turns, function calls,
--      approval requests/responses) that feeds the live transcript stream on /app/apps/voice/[id].

-- ── 1. pa_voice_calls v2 columns ────────────────────────────────────────────────────────────────
-- transcript_json: per-turn utterances [{ role: 'caller'|'poc', text, at_ms }] — the structured
-- twin of 094's transcript_full (which stays authoritative for the v1 pipeline; v2 writes both).
ALTER TABLE pa_voice_calls
  ADD COLUMN IF NOT EXISTS transcript_json jsonb;

-- function_calls: the realtime tool calls Poc made on the call, with their approval outcome:
-- [{ name, arguments, staged_action_id, outcome: 'staged'|'approved'|'rejected'|'expired' }].
ALTER TABLE pa_voice_calls
  ADD COLUMN IF NOT EXISTS function_calls jsonb;

-- engine: which audio pipeline drove the call. 'pipeline_v1' = 094's Whisper+ElevenLabs loop;
-- 'realtime_v2' = the OpenAI Realtime bridge. NULL = pre-v2 rows (all pipeline_v1 by definition).
ALTER TABLE pa_voice_calls
  ADD COLUMN IF NOT EXISTS engine text CHECK (engine IN ('pipeline_v1', 'realtime_v2'));

-- purpose: the owner-stated goal of an OUTBOUND call ("confirm Thursday's delivery with the
-- supplier"). Injected into Poc's realtime instructions; shown on the call detail page.
ALTER TABLE pa_voice_calls
  ADD COLUMN IF NOT EXISTS purpose text;

-- ── 2. pa_voice_call_events ─────────────────────────────────────────────────────────────────────
-- Append-only. owner_id is denormalized from the call row so RLS stays one-table cheap (the events
-- feed polls every ~2s while a call is live — no join per poll).
CREATE TABLE IF NOT EXISTS pa_voice_call_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id    uuid NOT NULL REFERENCES pa_voice_calls (id) ON DELETE CASCADE,
  owner_id   uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- 'speak_queue' is the outbound listen-in feed: the owner types a line, the bridge delivers it
  -- as Poc's next turn and flips payload.consumed — the row doubles as the audit record.
  event_type text NOT NULL CHECK (event_type IN ('speech', 'function_call', 'approval_request', 'approval_response', 'speak_queue')),
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The live transcript poll reads one call's events in order; the detail page reads the same.
CREATE INDEX IF NOT EXISTS pa_voice_call_events_call_created_idx
  ON pa_voice_call_events (call_id, created_at);

ALTER TABLE pa_voice_call_events ENABLE ROW LEVEL SECURITY;

-- Owner-scoped SELECT only — same posture as pa_voice_calls (094): no write policies, so the
-- service role (the bridge + webhook, which verify Twilio signatures / session auth before
-- mutating) is the only writer and every other role is denied.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pa_voice_call_events' AND policyname = 'pa_voice_call_events_owner_read'
  ) THEN
    CREATE POLICY pa_voice_call_events_owner_read ON pa_voice_call_events
      FOR SELECT USING (owner_id = auth.uid());
  END IF;
END $$;
