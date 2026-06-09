// /api/cron/rag-index — daily rebuild of turbovec zone indexes that have gone stale (PA-RAG-5).
//
// For every 'ready' index in the catalog, this checks the owner's brain repo for commits touching the
// zone since last_built_at. A zone with new commits gets its docs re-read and re-indexed (Modal
// build); a zone with no new commits is skipped — so the embedding spend tracks real churn, not the
// calendar. Bounded per cycle so one busy account can't starve the rest.

import { NextResponse } from "next/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listReadyRagIndexes, type RagIndexRow } from "@/lib/rag/db";
import { collectZoneDocs } from "@/lib/rag/zone-source";
import { buildOrRefreshIndex } from "@/lib/rag/query";
import { isRagRuntimeConfigured } from "@/lib/rag/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Cap zones rebuilt per cycle (a daily cron has 24h of headroom; this is a per-invocation guard).
const MAX_REBUILDS_PER_CYCLE = 50;

type ZoneResult = {
  ownerId: string;
  zonePath: string;
  status: "rebuilt" | "skipped" | "error";
  reason?: string;
  docCount?: number;
};

function ghHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** True when the zone has at least one commit since `since` (ISO). null `since` → treat as stale. */
async function zoneHasNewCommits(
  repo: string,
  token: string | null,
  zonePath: string,
  since: string | null,
): Promise<boolean> {
  if (!since) return true;
  const url =
    `https://api.github.com/repos/${repo}/commits` +
    `?path=${encodeURIComponent(zonePath)}&since=${encodeURIComponent(since)}&per_page=1`;
  const res = await fetch(url, { headers: ghHeaders(token), cache: "no-store" });
  if (!res.ok) return false; // can't tell → don't churn the index this cycle
  const commits = (await res.json()) as unknown[];
  return Array.isArray(commits) && commits.length > 0;
}

async function rebuildZone(row: RagIndexRow): Promise<ZoneResult> {
  const base: ZoneResult = { ownerId: row.owner_id, zonePath: row.zone_path, status: "skipped" };

  const paResult = await fetchPaUser(row.owner_id);
  if (!paResult.ok || !paResult.data?.brain_repo) {
    return { ...base, reason: "no brain repo" };
  }
  const repo = paResult.data.brain_repo;
  const token = paResult.data.github_token;

  const hasChanges = await zoneHasNewCommits(repo, token, row.zone_path, row.last_built_at);
  if (!hasChanges) return { ...base, reason: "no new commits" };

  const corpus = await collectZoneDocs(repo, token, row.zone_path);
  if (corpus.docs.length === 0) return { ...base, reason: "zone empty" };

  const built = await buildOrRefreshIndex({
    ownerId: row.owner_id,
    zonePath: row.zone_path,
    embeddingModel: row.embedding_model,
    docs: corpus.docs,
  });
  if (built.status === "built") {
    return { ...base, status: "rebuilt", docCount: built.docCount };
  }
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

  const rows = (await listReadyRagIndexes()).slice(0, MAX_REBUILDS_PER_CYCLE);
  const results: ZoneResult[] = [];
  for (const row of rows) {
    try {
      results.push(await rebuildZone(row));
    } catch (e) {
      results.push({
        ownerId: row.owner_id,
        zonePath: row.zone_path,
        status: "error",
        reason: e instanceof Error ? e.message : "unknown error",
      });
    }
  }

  const rebuilt = results.filter((r) => r.status === "rebuilt").length;
  return NextResponse.json({ ok: true, scanned: rows.length, rebuilt, results });
}
