-- 088_pocket_capture_api_tokens.sql — Pocket Capture PC-CORE-4 (iOS Shortcut + Siri voice surface).
--
-- The Voice Shortcut capture surface lets a user say "Hey Siri, Pocket Capture" and dictate a
-- thought; the published iOS Shortcut POSTs the dictated text to /api/capture/shortcut with a
-- per-user bearer token. This migration adds the token store that authenticates those calls:
--
--   pa_pocket_capture_api_tokens — one row per minted personal API token. We NEVER store the
--   plaintext token: only its SHA-256 hash (token_hash) and a short non-secret prefix
--   (token_prefix, e.g. "pca_abcd") for display in the management UI. The plaintext is shown to
--   the user exactly once at creation and never again. A token is soft-revoked by setting
--   revoked_at; the row stays for audit.
--
-- Additive + idempotent. RLS mirrors the Email / SMS inbound tables (084 / 087): owner-scoped
-- SELECT for the dashboard token list; every write (mint / revoke / last_used_at touch) goes
-- through the service-role key from the route, which resolves + gates ownership before writing.

-- ── pa_pocket_capture_api_tokens — per-user personal API tokens ───────────────────────────────────
-- token_hash is the SHA-256 (hex) of the full "pca_…" token; it is UNIQUE so a hash lookup resolves
-- a single owner. token_prefix is the first 8 chars of the token (NON-secret) for "pca_abcd…"
-- display. name is an optional friendly label the user gives a token in the management UI (additive
-- beyond the core token columns — never required to authenticate). last_used_at is touched on each
-- successful verify so the user can spot a stale or unexpected token. revoked_at soft-deletes it.
CREATE TABLE IF NOT EXISTS pa_pocket_capture_api_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  token_prefix  text NOT NULL,
  name          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

-- The verify path resolves an inbound token by the SHA-256 of its plaintext — index the lookup.
-- (The UNIQUE constraint already builds an index, but name it explicitly for intent + parity.)
CREATE INDEX IF NOT EXISTS pa_pocket_capture_api_tokens_token_hash_idx
  ON pa_pocket_capture_api_tokens (token_hash);

-- The dashboard lists an owner's tokens newest-first.
CREATE INDEX IF NOT EXISTS pa_pocket_capture_api_tokens_owner_idx
  ON pa_pocket_capture_api_tokens (owner_id, created_at DESC);

COMMENT ON TABLE pa_pocket_capture_api_tokens IS
  'Pocket Capture (PC-CORE-4) per-user personal API tokens for the iOS Shortcut capture surface. Stores only the SHA-256 hash + a non-secret display prefix; plaintext is shown once at creation. Soft-revoked via revoked_at. Service-role writes only.';

COMMENT ON COLUMN pa_pocket_capture_api_tokens.token_hash IS
  'SHA-256 (hex) of the full "pca_…" token. The plaintext is never stored.';
COMMENT ON COLUMN pa_pocket_capture_api_tokens.token_prefix IS
  'First 8 chars of the token (e.g. "pca_abcd") — NON-secret, for display in the management UI.';

ALTER TABLE pa_pocket_capture_api_tokens ENABLE ROW LEVEL SECURITY;

-- Owner reads their own tokens (the management surface). All writes are service-role only (the
-- service-role key bypasses RLS) — no INSERT/UPDATE/DELETE policy is granted to clients.
DROP POLICY IF EXISTS pa_pocket_capture_api_tokens_owner_select
  ON pa_pocket_capture_api_tokens;
CREATE POLICY pa_pocket_capture_api_tokens_owner_select
  ON pa_pocket_capture_api_tokens
  FOR SELECT USING (owner_id = auth.uid());
