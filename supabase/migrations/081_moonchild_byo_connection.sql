-- 081_moonchild_byo_connection.sql  (PA-LPB-13)
--
-- Widen pa_connections.provider CHECK to admit 'moonchild'.
--
-- The Moonchild MCP at forge.moonchild.ai/mcp is a read-only export bridge (13 tools, zero
-- generation). Owners bring their own msk_* token from studio.moonchild.ai → Settings →
-- Integrations → Moonchild MCP. The token is stored AES-256-GCM in pa_connections.config
-- (pattern established by vercel/github_build/supabase connectors, mig 044/048/049).
--
-- Config shape: { token_encrypted: "v1.…", mcp_url?: "https://forge.moonchild.ai/mcp" }
--   • mcp_url defaults to the public endpoint when absent.
--   • account_label stores the label the owner gave to the token at connect time.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL).
-- No table creation — purely a CHECK constraint widen.

ALTER TABLE pa_connections DROP CONSTRAINT IF EXISTS pa_connections_provider_check;
ALTER TABLE pa_connections
  ADD CONSTRAINT pa_connections_provider_check
  CHECK (provider IN (
    'gmail', 'calendar', 'slack', 'quickbooks', 'stripe_connect', 'zoom', 'calendly',
    'lead_scout', 'github_build', 'vercel', 'supabase',
    'moonchild'
  ));
