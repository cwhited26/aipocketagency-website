-- 084_pocket_capture_email_inbound.sql — Pocket Capture PC-CORE-2 (Email Inbound surface).
--
-- The Email Forward capture surface gives each Pocket Capture user a personal address
-- `<slug>@capture.aipocketagent.com`. Forwarding / BCCing mail to it lands the subject +
-- sender + (reply-chain-stripped) body in their Capture Inbox, with attachments staged in
-- Supabase Storage. This migration adds:
--
--   1. pocket_agent_users.pocket_capture_email_slug — the per-user random slug (the local
--      part of their forwarding address). Generated lazily on first inbound-config read.
--   2. pa_pocket_capture_email_inbound_log — an append-only audit row per inbound delivery
--      (matched or not). Also the idempotency ledger: a UNIQUE dedup_key collapses the
--      duplicate deliveries Resend/Svix retries produce, so a re-fire never double-captures.
--
-- Additive + idempotent. RLS mirrors the Lead Scout / Capture Inbox tables (044 / 066):
-- owner-scoped SELECT for the dashboard; every write goes through the service-role key from
-- the webhook (which resolves + gates ownership before inserting).

-- ── 1 · pocket_agent_users.pocket_capture_email_slug ─────────────────────────────────────────────
-- The slug is the secret local part of the user's forwarding address. NULL until provisioned.
-- A plain UNIQUE index enforces no two users share a slug; Postgres treats NULLs as distinct, so
-- any number of not-yet-provisioned users coexist.
ALTER TABLE public.pocket_agent_users
  ADD COLUMN IF NOT EXISTS pocket_capture_email_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS pocket_agent_users_capture_email_slug_key
  ON public.pocket_agent_users (pocket_capture_email_slug)
  WHERE pocket_capture_email_slug IS NOT NULL;

COMMENT ON COLUMN public.pocket_agent_users.pocket_capture_email_slug IS
  'Pocket Capture (PC-CORE-2) per-user email-forward slug: the local part of <slug>@capture.aipocketagent.com. NULL until lazily provisioned on first inbound-config read.';

-- ── 2 · pa_pocket_capture_email_inbound_log — audit + idempotency ledger ─────────────────────────
-- One row per inbound webhook delivery. owner_id is NULL for an unresolved slug (we audit the
-- attempt but never process it). processed flips true once the capture is written to the brain;
-- error_text carries the reason a matched delivery did not process (e.g. no brain connected).
-- dedup_key (the RFC822 Message-ID, or the Svix delivery id when absent) is UNIQUE: the webhook
-- claims a delivery by inserting this row first, so a duplicate delivery hits the unique index and
-- is skipped before any brain write happens.
CREATE TABLE IF NOT EXISTS pa_pocket_capture_email_inbound_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  from_email   text NOT NULL DEFAULT '',
  subject      text,
  dedup_key    text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed    boolean NOT NULL DEFAULT false,
  error_text   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The idempotency claim: a duplicate Resend delivery collides here and is dropped.
CREATE UNIQUE INDEX IF NOT EXISTS pa_pocket_capture_email_inbound_log_dedup_key
  ON pa_pocket_capture_email_inbound_log (dedup_key);

-- The dashboard lists an owner's recent inbound history newest-first.
CREATE INDEX IF NOT EXISTS pa_pocket_capture_email_inbound_log_owner_idx
  ON pa_pocket_capture_email_inbound_log (owner_id, received_at DESC);

ALTER TABLE pa_pocket_capture_email_inbound_log ENABLE ROW LEVEL SECURITY;

-- Owner reads their own audit rows (the dashboard surface). All writes are service-role only
-- (the service-role key bypasses RLS) — no INSERT/UPDATE/DELETE policy is granted to clients.
DROP POLICY IF EXISTS pa_pocket_capture_email_inbound_log_owner_select
  ON pa_pocket_capture_email_inbound_log;
CREATE POLICY pa_pocket_capture_email_inbound_log_owner_select
  ON pa_pocket_capture_email_inbound_log
  FOR SELECT USING (owner_id = auth.uid());
