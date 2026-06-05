-- Personas + Team — Wave 1 (Mode A: internal team share).
-- Additive migration — creates persona tables only. Never drops anything.
--
-- Apply to: PA Supabase project (POCKET_AGENT_SUPABASE_URL) via Supabase MCP after
-- the lane lands.
--
-- Scoping model: PA is one-business-per-user. `business_id` is the owner's auth user
-- id (= pocket_agent_users.id = auth.users.id). RLS lets an owner read/write their own
-- rows (business_id = auth.uid()). Team-member chat access does NOT use RLS — it is
-- gated by an opaque, revocable share token validated server-side with the
-- service-role key on every request (so a revoke takes effect within one request).
--
-- This restricts personas to Mode A this wave: `personas.mode` CHECKs to
-- ('internal_team') only. Modes B+C (public link, widget) extend the CHECK in Wave 2.

-- ── personas ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personas (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  slug                  TEXT        NOT NULL,
  template_key          TEXT        NOT NULL,
  tone                  TEXT        NOT NULL DEFAULT 'conversational'
                          CHECK (tone IN ('direct', 'conversational', 'coach')),
  mode                  TEXT        NOT NULL DEFAULT 'internal_team'
                          CHECK (mode IN ('internal_team')),
  status                TEXT        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  spec_path             TEXT        NOT NULL,
  knowledge_zone_key    TEXT        NOT NULL,
  current_spec_version  UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Slugs are unique within a business so zone paths never collide.
  UNIQUE (business_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_personas_business_id ON personas (business_id);
CREATE INDEX IF NOT EXISTS idx_personas_business_status ON personas (business_id, status);

ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personas_select_own" ON personas;
CREATE POLICY "personas_select_own" ON personas
  FOR SELECT USING (auth.uid() = business_id);
-- Writes go through the service-role key in server routes only.

-- ── persona_specs (immutable, versioned) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS persona_specs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id  UUID        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  version     INTEGER     NOT NULL,
  body_md     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Monotonic per-persona version number; an edit always inserts version+1.
  UNIQUE (persona_id, version)
);

CREATE INDEX IF NOT EXISTS idx_persona_specs_persona ON persona_specs (persona_id, version DESC);

ALTER TABLE persona_specs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_specs_select_own" ON persona_specs;
CREATE POLICY "persona_specs_select_own" ON persona_specs
  FOR SELECT USING (
    persona_id IN (SELECT id FROM personas WHERE business_id = auth.uid())
  );

-- The owner-facing current_spec_version is set after the first spec row exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'personas_current_spec_version_fkey'
  ) THEN
    ALTER TABLE personas
      ADD CONSTRAINT personas_current_spec_version_fkey
      FOREIGN KEY (current_spec_version) REFERENCES persona_specs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── persona_seats (internal team members) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS persona_seats (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id       UUID        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  invited_email    TEXT        NOT NULL,
  accepted_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  role             TEXT        NOT NULL DEFAULT 'member'
                     CHECK (role IN ('owner', 'manager', 'member')),
  invited_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at      TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,

  -- One live invite per email per persona (revoked rows are re-invitable via upsert).
  UNIQUE (persona_id, invited_email)
);

CREATE INDEX IF NOT EXISTS idx_persona_seats_persona ON persona_seats (persona_id);

ALTER TABLE persona_seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_seats_select_own" ON persona_seats;
CREATE POLICY "persona_seats_select_own" ON persona_seats
  FOR SELECT USING (
    persona_id IN (SELECT id FROM personas WHERE business_id = auth.uid())
  );

-- ── persona_share_tokens (opaque, revocable) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS persona_share_tokens (
  token       TEXT        PRIMARY KEY,
  persona_id  UUID        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  mode        TEXT        NOT NULL DEFAULT 'internal_team'
                CHECK (mode IN ('internal_team')),
  seat_id     UUID        REFERENCES persona_seats(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_persona_share_tokens_persona ON persona_share_tokens (persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_share_tokens_seat ON persona_share_tokens (seat_id);

ALTER TABLE persona_share_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_share_tokens_select_own" ON persona_share_tokens;
CREATE POLICY "persona_share_tokens_select_own" ON persona_share_tokens
  FOR SELECT USING (
    persona_id IN (SELECT id FROM personas WHERE business_id = auth.uid())
  );
-- Token validation in the chat surface reads via the service-role key (anonymous
-- team members have no auth session), so no broader SELECT policy is needed.

-- ── persona_conversations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS persona_conversations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id        UUID        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  seat_id           UUID        REFERENCES persona_seats(id) ON DELETE SET NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  message_count     INTEGER     NOT NULL DEFAULT 0,
  token_cost_total  INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_persona_conversations_persona
  ON persona_conversations (persona_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_persona_conversations_seat
  ON persona_conversations (seat_id);

ALTER TABLE persona_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_conversations_select_own" ON persona_conversations;
CREATE POLICY "persona_conversations_select_own" ON persona_conversations
  FOR SELECT USING (
    persona_id IN (SELECT id FROM personas WHERE business_id = auth.uid())
  );

-- ── persona_messages ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS persona_messages (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id       UUID        NOT NULL REFERENCES persona_conversations(id) ON DELETE CASCADE,
  role                  TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content               TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  tokens_used           INTEGER     NOT NULL DEFAULT 0,
  blocked_by_containment BOOLEAN    NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_persona_messages_conversation
  ON persona_messages (conversation_id, created_at ASC);

ALTER TABLE persona_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_messages_select_own" ON persona_messages;
CREATE POLICY "persona_messages_select_own" ON persona_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT c.id FROM persona_conversations c
      JOIN personas p ON p.id = c.persona_id
      WHERE p.business_id = auth.uid()
    )
  );

-- ── persona_usage_monthly (tier-cap running totals) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS persona_usage_monthly (
  persona_id     UUID        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  month          TEXT        NOT NULL,  -- 'yyyy-mm'
  message_count  INTEGER     NOT NULL DEFAULT 0,
  token_cost     INTEGER     NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (persona_id, month)
);

ALTER TABLE persona_usage_monthly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_usage_monthly_select_own" ON persona_usage_monthly;
CREATE POLICY "persona_usage_monthly_select_own" ON persona_usage_monthly
  FOR SELECT USING (
    persona_id IN (SELECT id FROM personas WHERE business_id = auth.uid())
  );

-- Atomic per-message usage increment used by the chat endpoint. SECURITY DEFINER so
-- the service-role caller upserts the (persona_id, month) running total in one round
-- trip without a read-modify-write race.
CREATE OR REPLACE FUNCTION increment_persona_usage(
  p_persona_id UUID,
  p_month      TEXT,
  p_messages   INTEGER,
  p_tokens     INTEGER
) RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO persona_usage_monthly (persona_id, month, message_count, token_cost, updated_at)
  VALUES (p_persona_id, p_month, p_messages, p_tokens, now())
  ON CONFLICT (persona_id, month) DO UPDATE
    SET message_count = persona_usage_monthly.message_count + EXCLUDED.message_count,
        token_cost    = persona_usage_monthly.token_cost + EXCLUDED.token_cost,
        updated_at    = now();
$$;
