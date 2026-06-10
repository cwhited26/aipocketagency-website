-- 074_channels_gateway.sql — Channels Gateway, Phase 1 (Slack) (PA-CHAN-1..8).
--
-- The Channels Gateway lets an owner reach their Pocket Agent from wherever they already work. One
-- inbound router + per-channel adapters; the owner connects a channel once, then any message they
-- send to it runs through the same Persona + Mission Control + Approval stack as the web app, and
-- the reply goes back out the same channel. Phase 1 ships the Slack adapter; SMS / iMessage /
-- WhatsApp / Telegram / web widget are queued for follow-up lanes.
--
-- Two owner-scoped tables (PA-CHAN-3):
--   1. pa_channel_connections — one row per owner+channel. Holds the paired external identity
--      (Slack team_id+user_id), the default Persona that answers on this channel, and the
--      AES-256-GCM-encrypted bot token. UNIQUE (channel_slug, external_id) is the resolve key the
--      inbound webhook looks an owner up by.
--   2. pa_channel_messages — append-only forensics: every inbound/outbound roundtrip is recorded
--      for owner audit + cost reconciliation. raw_payload is kept for forensics and PRUNED AFTER 30
--      DAYS (retention plan below).
--
-- Additive + idempotent. No CHECK widen needed (PA-CHAN spec §10). RLS mirrors the connection-table
-- pattern (migrations 013 / 044 / 063): owner-scoped SELECT for the settings surface; every write
-- goes through the service-role key from the API routes + the inbound webhook (which verify the
-- Slack signature and resolve ownership before mutating).
--
-- Token storage: auth_token_encrypted holds an AES-256-GCM envelope produced by lib/crypto/encrypt.ts
-- (key GMAIL_TOKEN_ENCRYPTION_KEY), the same envelope shape the Gmail + Slack-DM connections use.
--
-- 30-DAY RETENTION PLAN (pa_channel_messages.raw_payload): the raw provider payload is retained 30
-- days for forensics, then nulled. There is no cron in this lane; the prune runs as a scheduled
-- service-role sweep (queued with the follow-up channel lanes):
--   UPDATE pa_channel_messages SET raw_payload = NULL
--   WHERE raw_payload IS NOT NULL AND created_at < now() - interval '30 days';
-- The message row itself (direction, body snippet, cost_event_id) is kept for the owner's audit
-- trail; only the verbatim provider payload is pruned.

-- ── pa_channel_connections ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pa_channel_connections (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- 'slack' | (Phase 2+) 'sms' | 'imessage' | 'whatsapp' | 'telegram' | 'web_widget'
  channel_slug         text NOT NULL,
  -- The paired external identity. Slack: "<team_id>:<user_id>". Phone channels: the E.164 number.
  external_id          text NOT NULL,
  -- Which Persona answers on this channel (PA-CHAN-8). NULL = the gateway's default Persona.
  persona_id           uuid REFERENCES personas (id) ON DELETE SET NULL,
  -- AES-256-GCM envelope (lib/crypto/encrypt.ts). Slack: the bot token. Nullable so a row can exist
  -- mid-pair before the token lands.
  auth_token_encrypted text,
  -- Per-channel knobs (Slack: workspace name, scopes, bot_user_id, team_id, slack_user_id).
  config               jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled              boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  -- The inbound webhook resolves an owner by (channel, external identity); one row per pairing.
  UNIQUE (channel_slug, external_id)
);

-- Owner reads their own connections on the settings surface; the page lists by owner + channel.
CREATE INDEX IF NOT EXISTS pa_channel_connections_owner_idx
  ON pa_channel_connections (owner_id, channel_slug);

ALTER TABLE pa_channel_connections ENABLE ROW LEVEL SECURITY;

-- Owner-scoped SELECT only. No INSERT/UPDATE/DELETE policy: the service role bypasses RLS to write,
-- and the absence of write policies denies every other role (the settings surface never returns the
-- encrypted token column anyway).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pa_channel_connections' AND policyname = 'pa_channel_connections_owner_read'
  ) THEN
    CREATE POLICY pa_channel_connections_owner_read ON pa_channel_connections
      FOR SELECT USING (owner_id = auth.uid());
  END IF;
END $$;

-- ── pa_channel_messages (append-only) ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pa_channel_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES pa_channel_connections (id) ON DELETE CASCADE,
  direction     text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body          text NOT NULL,
  thread_id     text,
  attachments   jsonb,
  -- Verbatim provider payload, retained 30 days then nulled by the retention sweep (header).
  raw_payload   jsonb,
  -- The pa_cost_events row this roundtrip metered (featureSlug='channels:slack'), when present.
  cost_event_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- The owner audit view reads newest-first, scoped to a connection.
CREATE INDEX IF NOT EXISTS pa_channel_messages_conn_created_idx
  ON pa_channel_messages (connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pa_channel_messages_owner_created_idx
  ON pa_channel_messages (owner_id, created_at DESC);
-- The retention sweep scans rows with a still-present raw_payload past the 30-day cutoff.
CREATE INDEX IF NOT EXISTS pa_channel_messages_retention_idx
  ON pa_channel_messages (created_at)
  WHERE raw_payload IS NOT NULL;

ALTER TABLE pa_channel_messages ENABLE ROW LEVEL SECURITY;

-- Owner-scoped SELECT only. No INSERT/UPDATE/DELETE policy → append-only for every non-service role
-- (the webhook writes through the service-role key; nothing else mutates the forensics log).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pa_channel_messages' AND policyname = 'pa_channel_messages_owner_read'
  ) THEN
    CREATE POLICY pa_channel_messages_owner_read ON pa_channel_messages
      FOR SELECT USING (owner_id = auth.uid());
  END IF;
END $$;
