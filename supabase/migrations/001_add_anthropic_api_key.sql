-- Fix 1: BYO Anthropic API key per user
-- Run against the pocket_agent Supabase project (NEXT_PUBLIC_SUPABASE_URL)
ALTER TABLE pocket_agent_users
  ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;
