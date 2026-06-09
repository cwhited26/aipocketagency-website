-- 047_lead_scout_google_maps.sql — Lead Scout Phase 2 (the Google Maps sweep).
-- (Renumbered 045 -> 047: concurrent sibling lanes took 045 (project-workspaces) and 046 (github-build).)
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL — project haizcnyywvewjygzeaaf).
-- Apply AFTER 044_lead_scout.sql (which creates pa_lead_scout_sources). Both are still pending if
-- Phase 1's migration hasn't landed yet — run 044 first, then this.
--
-- Additive only. Two changes, neither drops data:
--   1. pa_lead_scout_sources.kind CHECK widened to admit 'google_maps' (the headline use case: pick a
--      category + location + radius + filters and PA builds the list itself off Google Maps). The
--      Phase-1 'url_list' kind is kept; the CHECK is rewritten as the full superset so this file
--      applies cleanly regardless of sibling lanes.
--   2. pa_lead_scout_sources gains a `config_json` JSONB column (nullable). A google_maps source
--      stores its sweep criteria here — { category, location, radius_miles, filters:{ no_website,
--      min_reviews, max_reviews, has_phone, has_email } } — instead of the url_list source's
--      extraction_pattern + seed_urls. url_list rows leave it null and are unaffected.
--
-- No change to pa_lead_scout_runs / pa_lead_scout_leads: a Maps lead reuses the existing lead row,
-- carrying the business's phone / website-status / reviews / address inside the `profile` JSONB and
-- its Maps listing URL in `url`, so no per-lead schema change is needed. The 'lead_scout_batch'
-- inbox kind (044) already covers the Maps batch card.

-- ── 1 · widen the source kind CHECK to admit google_maps ─────────────────────────────────────────
ALTER TABLE pa_lead_scout_sources DROP CONSTRAINT IF EXISTS pa_lead_scout_sources_kind_check;
ALTER TABLE pa_lead_scout_sources
  ADD CONSTRAINT pa_lead_scout_sources_kind_check
  CHECK (kind IN ('url_list', 'google_maps'));

-- ── 2 · add the sweep-config blob ────────────────────────────────────────────────────────────────
ALTER TABLE pa_lead_scout_sources
  ADD COLUMN IF NOT EXISTS config_json JSONB;
