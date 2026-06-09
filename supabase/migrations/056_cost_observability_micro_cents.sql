-- 056_cost_observability_micro_cents.sql — Cost Observability precision follow-up (PA-COST-9).
-- (Numbered 056: 053 = cost ledger, 054 = RAG indexes, 055 reserved by the in-flight RAG-extras lane —
--  a numbering gap is harmless; migrations run in lexical order.)
--
-- The Phase 1 ledger (053) stored realized cost as `unit_cost_cents INTEGER`. Every sub-cent event —
-- a single Haiku fit-classify (~0.08 cent), one Bright Data Web Unlocker request (0.3 cent) — rounded
-- to ZERO on write (Math.round in lib/cost/log), so the granular forensic trail the SPEC promised was
-- silently discarding the cheapest-but-most-frequent calls. This converts storage to BIGINT
-- MICRO-CENTS (1/10,000 of a cent; 1 USD = 1,000,000 micro-cents) — the Stripe `unit_amount_decimal` /
-- AWS-billing / ad-tech standard. A $0.0006 Haiku classify now stores losslessly and aggregations are
-- pure integer math. BIGINT max (9.2e18) leaves no overflow headroom concern at any plausible scale.
--
-- Additive + reversible. `unit_cost_cents` stays for one release as a GENERATED column (floor of
-- micro/10000) so any downstream reader that hasn't migrated still sees rounded-down integer cents
-- while the new column carries the precise value. Rollback path: DROP the generated `unit_cost_cents`,
-- re-add it as a plain `INTEGER` column, backfill `FLOOR(cost_micro_cents / 10000)`, DROP cost_micro_cents.

-- ── 1. Add the lossless micro-cents column ─────────────────────────────────────────────────────────
ALTER TABLE pa_cost_events
  ADD COLUMN IF NOT EXISTS cost_micro_cents BIGINT NOT NULL DEFAULT 0;

-- ── 2. Backfill from the existing integer-cents values (BEFORE unit_cost_cents becomes generated, which
--       would otherwise recompute from the still-zero micro column and lose the originals). Idempotent:
--       only touches rows not yet backfilled (micro still 0 but a non-zero integer cost was recorded). ──
UPDATE pa_cost_events
  SET cost_micro_cents = unit_cost_cents::BIGINT * 10000
  WHERE cost_micro_cents = 0 AND unit_cost_cents IS NOT NULL AND unit_cost_cents <> 0;

-- ── 3. Convert unit_cost_cents to a GENERATED backward-compat column (floor of micro / 10000). Guarded
--       on is_generated so a re-run is a no-op once the conversion has happened. ───────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pa_cost_events'
      AND column_name = 'unit_cost_cents'
      AND is_generated = 'NEVER'
  ) THEN
    ALTER TABLE pa_cost_events DROP COLUMN unit_cost_cents;
    ALTER TABLE pa_cost_events
      ADD COLUMN unit_cost_cents INTEGER
      GENERATED ALWAYS AS (FLOOR(cost_micro_cents / 10000)::INTEGER) STORED;
  END IF;
END $$;

COMMENT ON COLUMN pa_cost_events.cost_micro_cents IS
  'Realized cost in micro-cents (1/10,000 of a cent; 1 USD = 1,000,000). Lossless sub-cent storage, summable as pure integer math (PA-COST-9).';
COMMENT ON COLUMN pa_cost_events.unit_cost_cents IS
  'Backward-compat (one release): FLOOR(cost_micro_cents / 10000). Rounded-down integer cents for readers not yet on cost_micro_cents (PA-COST-9).';
