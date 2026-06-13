-- 079_pa_landing_pages_brain_scope.sql
-- PA-LPB-7..9: brain scope per project / client for the Landing Page Builder.
-- Apply to Supabase project haizcnyywvewjygzeaaf after PA web SHA lands on main.

-- brain_scope: repo-relative directory path the Builder loads brain context from.
--   NULL means the owner's brain root (today's behaviour, unchanged). A path like
--   "customers/valley-roofing" loads only that subtree. Sanitised at write-time.
ALTER TABLE pa_landing_pages
  ADD COLUMN brain_scope text;

-- brain_scope_domain: the `domain` field extracted from the scope's brand.json at create-time.
--   When set and the page goes live, the Builder stages a Vercel attachDomain approval card
--   so the owner can point the client's own domain at the page (PA-LPB-9, locked answer #4).
ALTER TABLE pa_landing_pages
  ADD COLUMN brain_scope_domain text;

COMMENT ON COLUMN pa_landing_pages.brain_scope IS
  'Repo-relative directory path the Landing Page Builder loads brain context from. '
  'NULL means the owner brain root (PA-LPB-7). '
  'Sanitized at write-time: no leading slash, no parent traversal, directories only.';

COMMENT ON COLUMN pa_landing_pages.brain_scope_domain IS
  'Domain extracted from the scope folder''s brand.json at create-time (PA-LPB-9). '
  'When set and the page goes live the Builder stages a Vercel attachDomain approval card.';
