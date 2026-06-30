-- 097_capture_tags.sql — owner-editable tag/tab definitions for the Captures Dashboard redesign.
--
-- The Captures Dashboard (PC-CORE-6) gets a MindChuk-style colored tab strip across the top. The
-- tabs are owner-editable from Settings → Capture Tags: a tag is a { name, color } the owner can
-- add / rename / recolor / reorder / delete. This migration adds the one table that stores those
-- definitions.
--
-- WHERE TAG *ASSIGNMENT* LIVES (important): a capture is NOT a SQL row. Captures live in the owner's
-- brain repo (memory/inbox.md PA-INBOX blocks + inbox/** files) and each already carries an additive
-- `tags: string[]` meta field (see src/lib/pa-inbox.ts — the same additive pattern that added
-- `source` and `deletedAt`). A capture belongs to a tab when its tags[] contains that tab's name
-- (case-insensitive); the per-card "Move to tag" writes the tab name into the capture's tags[] via the
-- existing PATCH /api/app/pocket-capture/captures/[id] route. So there is NO `tag_id` FK column on a
-- captures table — there is no captures table to widen — and this migration is purely additive: one
-- new owner-scoped table, nothing else touched.
--
-- The default seed (Wins / Ideas / Tasks / Reference; "All" is a virtual always-present tab the UI
-- renders, not a stored row) is created per-owner lazily on first read by the app data layer
-- (src/lib/pocket-capture/tags-db.ts ensureSeedTags) — a static SQL migration can't seed rows for
-- owners that don't exist yet. Additive + idempotent. RLS mirrors the Pocket Capture tables
-- (084 / 087 / 088): owner-scoped SELECT for the settings + dashboard surfaces; every write
-- (create / rename / recolor / reorder / delete) goes through the service-role key from the API
-- routes, which resolve + gate ownership before writing.

-- ── pa_capture_tags — one row per owner-defined capture tag/tab ─────────────────────────────────────
-- name is the display label AND the matching key against a capture's tags[] (we compare lower(name)).
-- color_hex is a 7-char "#rrggbb" drawn from the app's 12-color palette (validated in the route +
-- by a CHECK here as a backstop). sort_order drives the left-to-right tab order; the owner reorders
-- by drag and the route rewrites the whole set's sort_order. created_at orders ties deterministically.
CREATE TABLE IF NOT EXISTS pa_capture_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name        text NOT NULL,
  color_hex   text NOT NULL CHECK (color_hex ~* '^#[0-9a-f]{6}$'),
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The dashboard + settings read an owner's tags in tab order (sort_order, then created_at as a stable
-- tiebreak). Index that exact read.
CREATE INDEX IF NOT EXISTS pa_capture_tags_owner_order_idx
  ON pa_capture_tags (owner_id, sort_order, created_at);

-- A tab name is unique per owner (case-insensitive) — two tabs named "Wins" would be ambiguous when
-- matching a capture's tags[]. Enforced on lower(name) so "wins" and "Wins" collide.
CREATE UNIQUE INDEX IF NOT EXISTS pa_capture_tags_owner_name_uniq
  ON pa_capture_tags (owner_id, lower(name));

COMMENT ON TABLE pa_capture_tags IS
  'Captures Dashboard owner-editable tag/tab definitions (name + palette color + order). Tag ASSIGNMENT is not stored here: a capture (a memory/inbox.md block or inbox/** file in the brain repo) belongs to a tab when its additive tags[] meta contains the tab name. Service-role writes only.';

COMMENT ON COLUMN pa_capture_tags.name IS
  'Display label AND the case-insensitive key matched against a capture''s tags[] to decide tab membership.';
COMMENT ON COLUMN pa_capture_tags.color_hex IS
  'Tab color as #rrggbb, drawn from the app''s 12-color palette (src/lib/pocket-capture/tags.ts CAPTURE_TAG_PALETTE).';
COMMENT ON COLUMN pa_capture_tags.sort_order IS
  'Left-to-right tab order; reorder rewrites the whole owner set. Ties broken by created_at.';

ALTER TABLE pa_capture_tags ENABLE ROW LEVEL SECURITY;

-- Owner reads their own tags (the settings editor + the dashboard tab strip). All writes are
-- service-role only (the service-role key bypasses RLS) — no INSERT/UPDATE/DELETE policy is granted
-- to clients; the API routes gate ownership before every write.
DROP POLICY IF EXISTS pa_capture_tags_owner_select ON pa_capture_tags;
CREATE POLICY pa_capture_tags_owner_select ON pa_capture_tags
  FOR SELECT USING (owner_id = auth.uid());
