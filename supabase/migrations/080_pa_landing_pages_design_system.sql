-- 080_pa_landing_pages_design_system.sql
-- Additive columns for the Moonchild MCP design-system integration (PA-LPB-10).
-- Three columns on pa_landing_pages: the opaque DS reference from Moonchild, the source URL
-- (audit trail), and the cached DS snapshot so code-gen never depends on Moonchild being reachable.
-- Apply to: haizcnyywvewjygzeaaf

ALTER TABLE pa_landing_pages
  ADD COLUMN IF NOT EXISTS design_system_id text,
  ADD COLUMN IF NOT EXISTS design_system_imported_from text,
  ADD COLUMN IF NOT EXISTS design_system_snapshot jsonb;

COMMENT ON COLUMN pa_landing_pages.design_system_id IS
  'Opaque Moonchild MCP reference returned by the import-design-system call (PA-LPB-10). Null when no DS imported.';

COMMENT ON COLUMN pa_landing_pages.design_system_imported_from IS
  'Source URL the design system was generated from (audit trail). Null when no DS imported.';

COMMENT ON COLUMN pa_landing_pages.design_system_snapshot IS
  'Cached design system payload (palette, typography, components) so code-gen does not depend on Moonchild being reachable at build time (PA-LPB-10).';
