-- 109_ghl_agency_waitlist.sql — design-partner waitlist for Pocket Agent for GHL Agencies
-- (SPEC v1 §9 discovery-partner offer; marketing surface /for/ghl-agency).
-- Additive only: one new table, no changes to existing rows or constraints.
--
-- Rows arrive from the public marketing page (no auth), so owner_id is nullable. The API route
-- writes through the service-role key; the public INSERT policy exists so the table matches the
-- stated contract (insert public, read owner-of-record) even if a client-side writer lands later.

CREATE TABLE IF NOT EXISTS pa_ghl_agency_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  agency_name TEXT NOT NULL,
  client_count INTEGER NOT NULL CHECK (client_count >= 0),
  top_frustration TEXT NOT NULL,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_ghl_agency_waitlist_created
  ON pa_ghl_agency_waitlist (created_at DESC);

ALTER TABLE pa_ghl_agency_waitlist ENABLE ROW LEVEL SECURITY;

-- Insert is public (the waitlist form is pre-auth); anonymous rows carry owner_id NULL, a
-- signed-in submitter may only claim their own id.
DROP POLICY IF EXISTS pa_ghl_agency_waitlist_public_insert ON pa_ghl_agency_waitlist;
CREATE POLICY pa_ghl_agency_waitlist_public_insert ON pa_ghl_agency_waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());

-- Read is owner-of-record only. Admin reads go through the service-role key (bypasses RLS).
DROP POLICY IF EXISTS pa_ghl_agency_waitlist_owner_select ON pa_ghl_agency_waitlist;
CREATE POLICY pa_ghl_agency_waitlist_owner_select ON pa_ghl_agency_waitlist
  FOR SELECT USING (owner_id = auth.uid());
