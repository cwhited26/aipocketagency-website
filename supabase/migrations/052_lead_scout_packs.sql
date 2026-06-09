-- 052_lead_scout_packs.sql — Lead Scout Phase 4 (vertical pre-built packs).
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL — project haizcnyywvewjygzeaaf).
-- Apply AFTER 044_lead_scout.sql + 047_lead_scout_google_maps.sql + 051_lead_scout_outreach.sql.
--
-- Additive only. One change, no data dropped:
--   pa_lead_scout_sources gains `pack_slug` (nullable text). A source subscribed from a vertical pack
--   carries the pack's slug ('roofing', 'hvac', 'painting', 'general-contracting', 'med-spa',
--   'law-firm', 'dentist'); a hand-built source leaves it null. The pack configs themselves live as
--   static JSON in the repo (src/data/lead-scout-packs/<vertical>.json) — there are no pack rows. The
--   slug is the join back: the outreach drafter reads it to load the pack's vertical voice brief so
--   the cold email reads roofing-specific vs law-firm-specific, and the cron + batch card use it for
--   pack-specific framing. No new tables, no new inbox kind (the sweep reuses 'lead_scout_batch').

ALTER TABLE pa_lead_scout_sources
  ADD COLUMN IF NOT EXISTS pack_slug TEXT;

-- The packs page + the cron filter by pack membership occasionally; a partial index keeps that cheap
-- without weighing on the (far more common) hand-built sources, which leave pack_slug null.
CREATE INDEX IF NOT EXISTS idx_lead_scout_sources_pack
  ON pa_lead_scout_sources (pack_slug)
  WHERE pack_slug IS NOT NULL;
