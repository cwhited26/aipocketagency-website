-- Persona display_name — PA-POS-35 (Wingman-parity naming polish).
-- Additive migration — one nullable column, no backfill, never drops anything.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL) via Supabase MCP after
-- the lane lands.
--
-- `display_name` is the customer-chosen name for a Persona instance ("Marcus",
-- "Donna"). NULL means the owner never named it, and every surface falls back to
-- the template-derived `personas.name` ("Sales Assistant") through
-- getPersonaDisplayName() — no row rewrite, no rendered-name change for existing
-- personas. Poc stays the visual constant (PA-POS-33); the name is the only thing
-- that personalizes.

ALTER TABLE personas ADD COLUMN IF NOT EXISTS display_name TEXT;
