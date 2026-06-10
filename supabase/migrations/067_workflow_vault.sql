-- 067_workflow_vault.sql — AI Workflow Vault App (PA-VAULT-1..6).
--
-- The Workflow Vault is the App that ships 25 plug-and-play workflow recipes the owner one-tap
-- installs. Each recipe is a static JSON file in src/data/workflow-vault/ (precedent: the Lead Scout
-- vertical packs, src/data/lead-scout-packs/). Recipes are NOT rows — only INSTALLS are. Installing a
-- recipe writes one row here: the install row is the scheduled binding (it carries the persona it runs
-- as and whether its schedule is live), standing in for a routine because pocket_agent_routines is a
-- fixed-kind table (daily_brief / followup_sweep / weekly_digest) with no per-recipe slot.
--
-- Tier-gating is count-based and lives in code (src/lib/personas/tier-caps.ts workflowVaultUnlockCount):
-- Starter sees 3 unlocked, Pro 5, Pro+ 10, Studio 18, Studio+/Enterprise all 25. The $47 order-bump on
-- /start (kind='workflow_vault' in pocket_agent_addon_purchases) unlocks all 25 regardless of tier — the
-- purchase row itself is the unlock signal, so no extra column is needed here.
--
-- One new owner-scoped table. Additive + idempotent. RLS mirrors the Lead Scout / Follow-Up Sweeps /
-- Capture Inbox tables (044 / 063 / 066): owner-scoped SELECT for the surface; all writes go through the
-- service-role key from the install API route (which gates ownership before mutating).

-- ── pa_workflow_vault_installs — one row per installed recipe ─────────────────────────────────────
-- recipe_slug matches a file in src/data/workflow-vault/<slug>.json. configured_persona_id is the
-- persona the recipe runs as (chosen at install time, nullable until the owner picks one). schedule_active
-- mirrors the recipe's default_schedule_cron being live — toggling it off pauses the recipe without
-- uninstalling it. UNIQUE(owner_id, recipe_slug) makes install idempotent: re-installing the same recipe
-- updates the binding instead of duplicating it.
CREATE TABLE IF NOT EXISTS pa_workflow_vault_installs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  recipe_slug           text NOT NULL,
  configured_persona_id uuid REFERENCES personas (id) ON DELETE SET NULL,
  schedule_active       boolean NOT NULL DEFAULT true,
  installed_at          timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pa_workflow_vault_installs_owner_recipe_idx
  ON pa_workflow_vault_installs (owner_id, recipe_slug);
-- The surface lists an owner's installs on every page load — index that read (owner_id).
CREATE INDEX IF NOT EXISTS pa_workflow_vault_installs_owner_idx
  ON pa_workflow_vault_installs (owner_id);

ALTER TABLE pa_workflow_vault_installs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pa_workflow_vault_installs_owner_select ON pa_workflow_vault_installs;
CREATE POLICY pa_workflow_vault_installs_owner_select ON pa_workflow_vault_installs
  FOR SELECT USING (owner_id = auth.uid());

COMMENT ON TABLE pa_workflow_vault_installs IS
  'One row per Workflow Vault recipe an owner has installed; the row is the scheduled binding (persona + schedule_active). Recipes themselves are static JSON in src/data/workflow-vault/. PA-VAULT-1..6.';
