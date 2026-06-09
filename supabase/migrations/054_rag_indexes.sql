-- 054_rag_indexes.sql — RAG index bookkeeping (PA-RAG-1..7, Personas SPEC §3.5 turbovec amendment).
-- (Numbered 054: 044–052 were taken by concurrent lanes — Lead Scout, Project Workspace, the four
--  Build connectors, Podcast Ingest, Lead Scout outreach + packs — and 053 by Cost Observability
--  Phase 1. This is the next free number after that lane.)
--
-- One additive, non-destructive table. The vector indexes themselves are turbovec `.tq` / `.tvim`
-- files that live in a Modal volume next to nothing in Postgres — this table is only the catalog: per
-- (owner, zone) it records which embedding model built the index, how big the corpus was (so the Node
-- tier can decide vector-vs-grep without re-listing the zone), the build status, and when it last ran
-- (so the daily cron knows which zones have brain commits newer than their index).
--
-- RLS: owner-reads-own. The headless build/query surfaces hold the service key and write via the
-- service role (which bypasses RLS); there is no owner-write policy.

CREATE TABLE IF NOT EXISTS pa_rag_indexes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The brain-repo-relative zone this index covers, e.g. "memory" or "personas/vsm/knowledge".
  zone_path       text NOT NULL,
  -- BYO embedding model the index was built with, e.g. text-embedding-3-small (Personas SPEC §3.5).
  embedding_model text NOT NULL DEFAULT 'text-embedding-3-small',
  -- Corpus size at last build — drives the ~100-doc / ~50k-token vector-vs-grep threshold.
  doc_count       integer NOT NULL DEFAULT 0,
  token_count     integer NOT NULL DEFAULT 0,
  -- idle | building | ready | error
  status          text NOT NULL DEFAULT 'idle',
  last_built_at   timestamptz,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One index row per (owner, zone). The build claim and the cron both upsert on this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_rag_indexes_owner_zone
  ON pa_rag_indexes (owner_id, zone_path);
CREATE INDEX IF NOT EXISTS idx_pa_rag_indexes_owner_status
  ON pa_rag_indexes (owner_id, status);

ALTER TABLE pa_rag_indexes ENABLE ROW LEVEL SECURITY;

-- Owner reads their own index catalog. NO insert/update/delete policy: the service role bypasses RLS
-- to build + stamp, and the absence of write policies keeps the catalog service-managed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pa_rag_indexes' AND policyname = 'pa_rag_indexes_owner_read'
  ) THEN
    CREATE POLICY pa_rag_indexes_owner_read ON pa_rag_indexes
      FOR SELECT USING (owner_id = auth.uid());
  END IF;
END $$;

COMMENT ON TABLE pa_rag_indexes IS
  'turbovec index catalog (PA-RAG-1). One row per (owner, zone): embedding model, corpus size, build status + last_built_at. Indexes are .tq/.tvim files in a Modal volume; this is only the bookkeeping. Owner-read RLS, service-role write.';
