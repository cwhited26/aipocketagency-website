-- 082_meeting_persona.sql — Meeting Persona foundation (MP-CORE-1).
--
-- The Meeting Persona App (Pocket_Agent_Meeting_Persona_SPEC_v1.md) puts a brain-aware Persona into
-- the owner's Zoom / Google Meet / Teams calls via the Recall.ai meeting-bot infrastructure. This
-- lane (MP-CORE-1, SPEC §9 step 1) ships ONLY the Recall.ai connector foundation: the owner's
-- encrypted API key, the per-meeting bot-session ledger, and the append-only webhook audit log.
-- The lifecycle orchestrator, brain pre-load, chat watcher, post-call drafts, and the App surface
-- itself land in MP-CORE-2..N. No App/Persona wiring here.
--
-- Three owner-scoped tables:
--   1. pa_meeting_persona_connections — one row per owner. Holds the AES-256-GCM-encrypted Recall.ai
--      API key (lib/crypto/recall-key.ts, key RECALL_API_KEY_ENCRYPTION_KEY). UNIQUE(owner_id):
--      one Recall connection per owner.
--   2. pa_meeting_persona_sessions — one row per bot dispatched to a meeting. recall_bot_id is the
--      external Recall bot id and the resolve key the webhook updates a session by (UNIQUE). The
--      consent columns (participant_consent_disclosed, stop_keyword_invoked) back the MP-CORE-7
--      consent layer (SPEC §7 / §10) even though this lane ships no consent UI — the data model
--      must support it now so the legal layer has somewhere to write later.
--   3. pa_meeting_persona_webhook_events — append-only forensics. EVERY Recall webhook delivery is
--      recorded regardless of signature verification (audit trail). event_id (the Svix message id)
--      is UNIQUE: it is the idempotency key the webhook route claims to guarantee re-delivery never
--      double-processes a session update.
--
-- Additive + idempotent. RLS mirrors the connection-table pattern (013 / 044 / 063 / 074):
-- owner-scoped SELECT for the settings surface; every write goes through the service-role key from
-- the API routes + the webhook (which verifies the Recall/Svix signature and resolves ownership
-- before mutating). The webhook_events table has NO RLS policy at all — it is service-role only.
--
-- Token storage: api_key_encrypted holds an AES-256-GCM envelope produced by lib/crypto/recall-key.ts
-- (key RECALL_API_KEY_ENCRYPTION_KEY — a dedicated key, separate from GMAIL_TOKEN_ENCRYPTION_KEY /
-- LLM_PROVIDER_KEY_ENCRYPTION_KEY, for an independent key-rotation path per the repo's per-surface
-- crypto convention).

-- ── set_updated_at() — reusable BEFORE UPDATE trigger function ────────────────────────────────────
-- The repo had no shared updated_at trigger (older tables set updated_at from the app layer). This
-- lane introduces one so pa_meeting_persona_sessions.updated_at is authoritative even when a write
-- bypasses the app (the webhook PATCHes the row directly via the service role). CREATE OR REPLACE is
-- idempotent; future lanes can attach the same trigger.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── pa_meeting_persona_connections ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pa_meeting_persona_connections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- AES-256-GCM envelope of the owner's Recall.ai API key (lib/crypto/recall-key.ts). Never plaintext.
  api_key_encrypted  text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  -- Stamped each time /connect re-validates the key against the Recall.ai API.
  last_verified_at   timestamptz,
  -- One Recall connection per owner.
  UNIQUE (owner_id)
);

ALTER TABLE pa_meeting_persona_connections ENABLE ROW LEVEL SECURITY;

-- Owner-scoped SELECT only. No INSERT/UPDATE/DELETE policy → the service role bypasses RLS to write,
-- and the absence of write policies denies every other role. (The settings surface reads connection
-- state through a public projection that never returns the encrypted key column.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pa_meeting_persona_connections'
      AND policyname = 'pa_meeting_persona_connections_owner_read'
  ) THEN
    CREATE POLICY pa_meeting_persona_connections_owner_read ON pa_meeting_persona_connections
      FOR SELECT USING (owner_id = auth.uid());
  END IF;
END $$;

-- ── pa_meeting_persona_sessions ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pa_meeting_persona_sessions (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- External Recall.ai bot id. The webhook resolves the session to update by this id.
  recall_bot_id                 text NOT NULL UNIQUE,
  meeting_url                   text NOT NULL,
  meeting_provider              text CHECK (meeting_provider IN ('zoom', 'meet', 'teams', 'other')),
  meeting_start_at              timestamptz,
  meeting_end_at                timestamptz,
  -- Bot lifecycle. Advanced by the webhook as Recall reports status changes.
  status                        text NOT NULL DEFAULT 'scheduled'
                                  CHECK (status IN ('scheduled', 'joining', 'in_meeting', 'recording',
                                                    'left', 'failed', 'cancelled')),
  -- Recall bot metadata (region, bot_name, config echo) — opaque, kept for the per-meeting view.
  bot_metadata                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  recording_url                 text,
  transcript_available          boolean NOT NULL DEFAULT false,
  -- Consent layer (MP-CORE-7 / SPEC §7). Set when the auto-disclosure chat message has been posted,
  -- and when any participant invoked the STOP keyword. No UI in this lane — the columns exist so the
  -- consent layer has a home.
  participant_consent_disclosed boolean NOT NULL DEFAULT false,
  stop_keyword_invoked          boolean NOT NULL DEFAULT false,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

-- The owner's per-meeting list reads newest-first; the poll/sweep paths filter by status.
CREATE INDEX IF NOT EXISTS pa_meeting_persona_sessions_owner_created_idx
  ON pa_meeting_persona_sessions (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pa_meeting_persona_sessions_status_idx
  ON pa_meeting_persona_sessions (status);

DROP TRIGGER IF EXISTS pa_meeting_persona_sessions_set_updated_at ON pa_meeting_persona_sessions;
CREATE TRIGGER pa_meeting_persona_sessions_set_updated_at
  BEFORE UPDATE ON pa_meeting_persona_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE pa_meeting_persona_sessions ENABLE ROW LEVEL SECURITY;

-- Owner-scoped SELECT only. Writes go through the service role (the connect/status routes + webhook).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pa_meeting_persona_sessions'
      AND policyname = 'pa_meeting_persona_sessions_owner_read'
  ) THEN
    CREATE POLICY pa_meeting_persona_sessions_owner_read ON pa_meeting_persona_sessions
      FOR SELECT USING (owner_id = auth.uid());
  END IF;
END $$;

-- ── pa_meeting_persona_webhook_events (append-only, service-role only) ───────────────────────────

CREATE TABLE IF NOT EXISTS pa_meeting_persona_webhook_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The Svix message id (svix-id header) — the idempotency key. UNIQUE so a re-delivery hits 23505
  -- and the route skips reprocessing (the audit row from the first delivery already exists).
  event_id           text NOT NULL UNIQUE,
  recall_bot_id      text,
  event_type         text NOT NULL,
  payload            jsonb NOT NULL,
  -- Whether the Recall/Svix signature verified. Recorded for BOTH verified and unverified deliveries
  -- so a forged/misconfigured webhook is visible in the audit log rather than silently dropped.
  signature_verified boolean NOT NULL,
  received_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_meeting_persona_webhook_events_bot_idx
  ON pa_meeting_persona_webhook_events (recall_bot_id, received_at DESC);

-- RLS ON with NO policy → every non-service role is denied. The webhook writes (and dedup-claims)
-- through the service-role key, which bypasses RLS. This log is operator/forensics only; owners read
-- their meeting state through pa_meeting_persona_sessions, not the raw event log.
ALTER TABLE pa_meeting_persona_webhook_events ENABLE ROW LEVEL SECURITY;
