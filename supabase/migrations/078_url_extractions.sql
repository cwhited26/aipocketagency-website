-- 078_url_extractions.sql — the URL extraction worker's run ledger (recon Lane C, PA-CINS).
-- One row per extraction run the Competitor Inspector (and any future Design DNA consumer) fires.
-- Additive only. Writes go through the service role from API routes; the owner reads their own rows.

CREATE TABLE IF NOT EXISTS pa_url_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  -- running → extracted (worker done, profile generated) → awaiting_approval (commit staged on the
  -- Inbox) → committed (profile in the owner's brain) | failed (error column says why).
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'extracted', 'awaiting_approval', 'committed', 'failed')),
  -- The owner's optional note from the capture form, carried into the profile frontmatter.
  note text,
  -- The generated competitor profile (frontmatter + prose), held here until the staged approval
  -- commits it to the brain. Kept after commit so re-renders never depend on a GitHub read.
  profile_md text,
  -- The unattended-run extraction log: every state-diff attempt, every skip, every failure.
  extraction_log_md text,
  -- Screenshot manifest: [{ name, base64 }] JPEG captures committed beside the profile on approval.
  screenshots jsonb,
  -- Brain paths once committed (e.g. competitors/linear-app/profile.md + .../extraction-log.md).
  dna_record_path text,
  extraction_log_path text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_url_extractions_owner_created
  ON pa_url_extractions (owner_id, created_at DESC);

ALTER TABLE pa_url_extractions ENABLE ROW LEVEL SECURITY;

-- Owner reads their own rows; all writes ride the service role from gated API routes.
DROP POLICY IF EXISTS pa_url_extractions_owner_select ON pa_url_extractions;
CREATE POLICY pa_url_extractions_owner_select ON pa_url_extractions
  FOR SELECT USING (owner_id = auth.uid());
