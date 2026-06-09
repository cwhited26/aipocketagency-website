-- 058_decision_roundtable.sql — Decision Roundtable (PA-DR-1..7).
--
-- Two additive, owner-scoped tables backing the multi-agent debate feature: a roundtable header row
-- per question and one turn row per agent argument (or owner interjection). Both are read by the owner
-- (RLS SELECT on owner_id) and written only by the service-role orchestrator routes — there is no
-- INSERT/UPDATE/DELETE policy, so the anon/authenticated role is denied writes by default. Nothing here
-- touches an existing table; the live card the owner sees rides pocket_agent_messages.metadata (a jsonb
-- blob validated render-side), so no card-kind CHECK constraint needs widening.

-- ── Roundtable header ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_decision_roundtables (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The chat thread the question came from (pocket_agent_conversations). Null for a roundtable started
  -- outside a conversation. No FK: pocket_agent_conversations lives in the same DB but we keep this
  -- decoupled so deleting a thread never cascades away a saved decision.
  conversation_id     UUID,
  question            TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'verdict_ready', 'saved', 'rejected', 'cancelled')),
  -- Coarse decision shape + stakes, derived at start from the question signals. Used by the history
  -- page filters and stamped into the saved brain file's frontmatter.
  decision_type       TEXT        NOT NULL DEFAULT 'other'
                        CHECK (decision_type IN ('pricing','hiring','firing','acquisition','scope','other')),
  stakes_level        TEXT        NOT NULL DEFAULT 'medium'
                        CHECK (stakes_level IN ('low','medium','high')),
  -- provider:model strings actually used, one per agent (e.g. {pa_managed:claude-sonnet-4-6, openai:gpt-4o}).
  model_backings      TEXT[]      NOT NULL DEFAULT '{}',
  -- How many argue-rounds this roundtable runs before the Moderator (default 3, PA-DR round structure).
  total_rounds        INT         NOT NULL DEFAULT 3,
  -- The owner-accepted synthesis (set when status = saved). NULL until then.
  verdict             TEXT,
  -- brain/decisions/<YYYY-MM-DD>-<slug>.md once saved.
  verdict_brain_path  TEXT,
  -- One-line reason when the owner rejects the verdict (status = rejected) — feeds trigger calibration.
  rejection_reason    TEXT,
  -- Best-effort optimistic lock for the /advance orchestration step: a worker claims the run by
  -- stamping this; a second concurrent /advance sees it non-null and backs off. Cleared when the
  -- round completes. Purely internal — never surfaced to the owner.
  run_lock_at         TIMESTAMPTZ,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  saved_at            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_roundtables_owner
  ON pa_decision_roundtables (owner_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_roundtables_conversation
  ON pa_decision_roundtables (conversation_id);

ALTER TABLE pa_decision_roundtables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decision_roundtables_select_own" ON pa_decision_roundtables;
CREATE POLICY "decision_roundtables_select_own"
  ON pa_decision_roundtables FOR SELECT USING (auth.uid() = owner_id);
-- No INSERT/UPDATE/DELETE policy: writes are service-role only (orchestrator routes).

-- ── Turns (one per agent argument or owner interjection) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS pa_decision_roundtable_turns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  roundtable_id   UUID        NOT NULL REFERENCES pa_decision_roundtables(id) ON DELETE CASCADE,
  -- Denormalized owner_id so the turn RLS is a direct column check (no subquery join per row).
  owner_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL
                    CHECK (role IN ('steelman','devils_advocate','domain_specialist','moderator','owner_interjection')),
  -- provider:model that produced this turn ('owner' for an interjection).
  model_backing   TEXT        NOT NULL DEFAULT 'owner',
  -- Which argue-round this turn belongs to (0-based). The Moderator turn carries the final round index;
  -- an owner interjection carries the round it lands before.
  round_index     INT         NOT NULL DEFAULT 0,
  -- Ordinal across the whole transcript, for stable display ordering.
  turn_index      INT         NOT NULL DEFAULT 0,
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_roundtable_turns_rt
  ON pa_decision_roundtable_turns (roundtable_id, turn_index ASC);

ALTER TABLE pa_decision_roundtable_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decision_roundtable_turns_select_own" ON pa_decision_roundtable_turns;
CREATE POLICY "decision_roundtable_turns_select_own"
  ON pa_decision_roundtable_turns FOR SELECT USING (auth.uid() = owner_id);
-- No INSERT/UPDATE/DELETE policy: writes are service-role only (orchestrator routes).
