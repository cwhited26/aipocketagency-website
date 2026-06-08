-- Inbound email handler — two addresses on one shared parsing pipeline:
--   <owner>@inbound.aipocketagent.com  → forwarding ("act on this", a chat message to PA)
--   <owner>@bcc.aipocketagent.com      → BCC awareness ("be aware", log + watch the thread)
--
-- Additive migration — creates three new tables only, never drops anything.
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL).
-- RLS: owners SELECT their own rows only. All INSERT/UPDATE/DELETE happen via the
--      service-role key (the inbound webhook, the gmail-sync cron, the purge route).

-- ── 1. Address book ───────────────────────────────────────────────────────────
-- One row per (owner, kind). The local_part is the <owner> prefix; it is unique
-- within a kind so two owners can never share an address. Auto-provisioned on
-- signup from a slug of the account name (random token on collision).
CREATE TABLE IF NOT EXISTS pa_inbound_addresses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_part  TEXT        NOT NULL,
  kind        TEXT        NOT NULL CHECK (kind IN ('inbound', 'bcc')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One address per kind per owner, and a local_part is globally unique per kind
  -- (the routing lookup keys on (kind, local_part)).
  UNIQUE (owner_id, kind),
  UNIQUE (kind, local_part)
);

CREATE INDEX IF NOT EXISTS idx_pa_inbound_addresses_owner
  ON pa_inbound_addresses (owner_id);

ALTER TABLE pa_inbound_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_inbound_addresses_select_own" ON pa_inbound_addresses;
CREATE POLICY "pa_inbound_addresses_select_own"
  ON pa_inbound_addresses
  FOR SELECT
  USING (auth.uid() = owner_id);

-- ── 2. BCC thread-watch ───────────────────────────────────────────────────────
-- When an owner BCCs <owner>@bcc on an outgoing email, we register a watch for the
-- recipient's reply. The gmail-sync cron matches new inbox mail against open watches
-- and, on a hit, drafts the owner's reply (staged in Mission Control). Watches expire
-- after 30 days so a never-answered email doesn't watch forever.
CREATE TABLE IF NOT EXISTS pa_bcc_thread_watch (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The Gmail thread id (when known) or the RFC 2822 Message-ID of the original
  -- outgoing message — whichever we could capture from the BCC'd copy.
  gmail_thread_or_msg_id TEXT        NOT NULL,
  -- The RFC 2822 Message-ID of the original outgoing email, used as In-Reply-To when
  -- the drafted reply is sent so it threads onto the recipient's reply.
  original_rfc_message_id TEXT,
  recipient_addr         TEXT        NOT NULL,
  original_subject       TEXT        NOT NULL,
  expires_at             TIMESTAMPTZ NOT NULL,
  status                 TEXT        NOT NULL
                           CHECK (status IN ('watching', 'reply-drafted', 'expired', 'purged'))
                           DEFAULT 'watching',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cron hot path: "give me this owner's open watches".
CREATE INDEX IF NOT EXISTS idx_pa_bcc_thread_watch_owner_status
  ON pa_bcc_thread_watch (owner_id, status);

ALTER TABLE pa_bcc_thread_watch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_bcc_thread_watch_select_own" ON pa_bcc_thread_watch;
CREATE POLICY "pa_bcc_thread_watch_select_own"
  ON pa_bcc_thread_watch
  FOR SELECT
  USING (auth.uid() = owner_id);

-- ── 3. Inbound email log ──────────────────────────────────────────────────────
-- Every email that lands on either address, for the privacy-review page. brain_path
-- points at the captured brain file (bcc kind) so "Purge from brain" can hard-delete it.
CREATE TABLE IF NOT EXISTS pa_inbound_email_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_kind  TEXT        NOT NULL CHECK (address_kind IN ('inbound', 'bcc')),
  from_addr     TEXT        NOT NULL,
  to_addr       TEXT        NOT NULL,
  subject       TEXT,
  body_text     TEXT,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  brain_path    TEXT,
  -- 'received' (logged), 'reply-sent' (inbound: PA replied), 'reply-drafted' (bcc:
  -- reply staged), 'purged' (owner hard-deleted the capture).
  status        TEXT        NOT NULL
                  CHECK (status IN ('received', 'reply-sent', 'reply-drafted', 'purged'))
                  DEFAULT 'received',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_inbound_email_log_owner
  ON pa_inbound_email_log (owner_id, address_kind, received_at DESC);

ALTER TABLE pa_inbound_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pa_inbound_email_log_select_own" ON pa_inbound_email_log;
CREATE POLICY "pa_inbound_email_log_select_own"
  ON pa_inbound_email_log
  FOR SELECT
  USING (auth.uid() = owner_id);

-- No INSERT / UPDATE / DELETE policies on any of the three tables: writes are denied
-- for the anon/authenticated role and only the service-role key (server routes) mutates.
