// /api/cron/rag-index — daily build/refresh of turbovec zone indexes (PA-RAG-5, PA-RAG-8).
//
// Walks every buildable index in the catalog — 'ready' zones (refresh on change) and 'idle' zones
// (never built — registered, awaiting a first index) — and resolves each to its zone descriptor. A
// zone is rebuilt only when it has actually changed since its last build: for a file zone (brain
// memory / persona knowledge) the gate is the latest brain commit touching the zone path; for a
// project zone (pa_project_memory / pa_project_references) it is the newest row's timestamp. The
// per-zone state lives in the catalog's change_cursor column, so a zone nothing touched is skipped —
// no embedding spend on a corpus that didn't move. Sub-threshold zones are skipped too: a vector
// index for a dozen docs is pure overhead (PA-RAG-2). buildOrRefreshIndex is idempotent, so a rebuild
// that overlaps another dispatch collapses to one.

import { NextResponse } from "next/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listBuildableRagIndexes, type RagIndexRow } from "@/lib/rag/db";
import { buildOrRefreshIndex } from "@/lib/rag/query";
import { isRagRuntimeConfigured } from "@/lib/rag/client";
import { descriptorForZonePath, zoneCursorChanged } from "@/lib/rag/zones";
import { shouldUseVector } from "@/lib/rag/types";
import { ragLog, errMsg } from "@/lib/rag/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Cap zones rebuilt per cycle (a daily cron has 24h of headroom; this is a per-invocation guard).
const MAX_REBUILDS_PER_CYCLE = 50;

type OwnerBrain = { brain_repo: string | null; github_token: string | null };

type ZoneResult = {
  ownerId: string;
  zonePath: string;
  status: "rebuilt" | "skipped" | "error";
  reason?: string;
  docCount?: number;
};

/** ~4 chars/token corpus estimate for the threshold gate (no tokenizer dependency). */
function estimateTokens(docs: { text: string }[]): number {
  let chars = 0;
  for (const d of docs) chars += d.text.length;
  return Math.ceil(chars / 4);
}

async function refreshZone(row: RagIndexRow, brain: OwnerBrain): Promise<ZoneResult> {
  const base: ZoneResult = { ownerId: row.owner_id, zonePath: row.zone_path, status: "skipped" };

  const descriptor = descriptorForZonePath(
    row.owner_id,
    row.zone_path,
    brain.brain_repo,
    brain.github_token,
  );
  if (!descriptor) return { ...base, reason: "no descriptor (file zone without brain repo?)" };

  // Change gate: rebuild a built zone only when its source moved; always build a never-built one.
  const currentCursor = await descriptor.currentCursor();
  const changed = zoneCursorChanged(row.change_cursor, currentCursor, row.status === "idle");
  if (!changed) return { ...base, reason: "unchanged" };

  const docs = await descriptor.loadDocs();
  if (docs.length === 0) return { ...base, reason: "zone empty" };

  // Don't stand up a vector index for a sub-threshold zone — file-grep already serves it (PA-RAG-2).
  if (!shouldUseVector(docs.length, estimateTokens(docs))) {
    return { ...base, reason: "below threshold" };
  }

  const built = await buildOrRefreshIndex({
    ownerId: row.owner_id,
    zonePath: row.zone_path,
    embeddingModel: row.embedding_model,
    docs,
    zoneType: descriptor.zoneType,
    changeCursor: currentCursor,
  });
  if (built.status === "built") return { ...base, status: "rebuilt", docCount: built.docCount };
  if (built.status === "skipped") return { ...base, reason: built.reason };
  return { ...base, status: "error", reason: built.reason };
}

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isRagRuntimeConfigured()) {
    return NextResponse.json({ ok: true, skipped: "runtime_not_configured", results: [] });
  }

  const rows = (await listBuildableRagIndexes()).slice(0, MAX_REBUILDS_PER_CYCLE);
  // Cache each owner's brain repo + token once per cycle (file zones need it; project zones don't).
  const brainCache = new Map<string, OwnerBrain>();
  const results: ZoneResult[] = [];

  for (const row of rows) {
    try {
      let brain = brainCache.get(row.owner_id);
      if (!brain) {
        const paResult = await fetchPaUser(row.owner_id);
        brain =
          paResult.ok && paResult.data
            ? { brain_repo: paResult.data.brain_repo, github_token: paResult.data.github_token }
            : { brain_repo: null, github_token: null };
        brainCache.set(row.owner_id, brain);
      }
      results.push(await refreshZone(row, brain));
    } catch (e) {
      // One zone failing must not crash the whole job.
      results.push({
        ownerId: row.owner_id,
        zonePath: row.zone_path,
        status: "error",
        reason: errMsg(e),
      });
    }
  }

  const rebuilt = results.filter((r) => r.status === "rebuilt").length;
  ragLog.info("rag-index cron complete", { scanned: rows.length, rebuilt });
  return NextResponse.json({ ok: true, scanned: rows.length, rebuilt, results });
}
