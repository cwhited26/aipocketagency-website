-- Add digest cache columns to pocket_agent_users.
-- Two optional columns: the cached JSON blob and when it was generated.
-- Additive only — never drops or alters existing columns.

alter table pocket_agent_users
  add column if not exists brain_digest_json jsonb,
  add column if not exists brain_digest_generated_at timestamptz;
