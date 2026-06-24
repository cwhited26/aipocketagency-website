-- 089_pocket_capture_onboarding.sql — Pocket Capture onboarding wizard state (PC-MARK-3).
--
-- One additive column, no destructive migration:
--   pocket_agent_users.pocket_capture_onboarding_completed_at — set when a Pocket Capture standalone
--   buyer finishes (or explicitly skips) the 4-step setup wizard. The /app/captures dashboard
--   (PC-CORE-6) reads it to redirect new buyers back into onboarding until done.
--
-- The iOS Shortcut API token store (pa_pocket_capture_api_tokens) is owned by PC-CORE-4/PC-CORE-5
-- (migration 088); the wizard's "generate your key" step calls that lane's mint endpoint
-- (POST /api/app/pocket-capture/api-tokens) rather than provisioning its own table.
--
-- (Numbered 089: 082–088 taken by concurrent lanes — Meeting Persona 082/083, Pocket Capture email
-- inbound 084, reminders 086, Twilio SMS 087, API tokens 088.)

ALTER TABLE pocket_agent_users
  ADD COLUMN IF NOT EXISTS pocket_capture_onboarding_completed_at timestamptz;

COMMENT ON COLUMN pocket_agent_users.pocket_capture_onboarding_completed_at IS
  'PC-MARK-3: when the Pocket Capture standalone buyer finished/skipped the setup wizard. NULL = not yet onboarded.';
