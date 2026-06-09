// zones.ts — zone descriptors (PA-RAG-8). The one place that knows, for each RAG zone, how to read
// its documents and how to tell whether it has changed since the last index build. Both the daily
// cron (to skip zones nothing touched) and any future build trigger go through these, so a zone's
// "what's in it" + "has it changed" logic lives in exactly one place — for the two shapes a zone can
// take:
//
//   file zone    — brain-repo files. Docs come from the repo tree; the change cursor is the latest
//                  commit SHA touching the zone path.   memory · personas/<slug>/knowledge
//   project zone — pa_project_memory / pa_project_references rows. Docs come from Supabase; the change
//                  cursor is the newest row's created_at.   project/<id>/memory · project/<id>/references
//
// This is what "makes project memory + references zone-backed" (PA-RAG-7 deferred them as not-a-zone):
// they now have descriptors with the same loadDocs + change-cursor contract as the brain-repo zones.

import { listProjectMemory, listProjectReferences } from "@/lib/pa-projects";
import { collectZoneDocs } from "./zone-source";
import { normalizeZonePath } from "./types";
import type { RagBuildDoc } from "./client";
import type { RagChangeCursor, RagZoneType } from "./db";
import { ragLog, errMsg } from "./log";

export type ZoneDescriptor = {
  zonePath: string;
  zoneType: RagZoneType;
  /** Reads every source doc in the zone ({ docPath, text }) — used to (re)build the index. */
  loadDocs: () => Promise<RagBuildDoc[]>;
  /**
   * The zone's current change-detection state: { commitSha } for a file zone, { rowTimestamp } for a
   * project zone. Returns an empty cursor when it can't be determined (a GitHub error, an empty zone)
   * — zoneCursorChanged treats that as "don't churn" for a built zone.
   */
  currentCursor: () => Promise<RagChangeCursor>;
};

function ghHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Latest commit SHA touching `pathPrefix` in the brain repo, or null. The file-zone change cursor. */
async function lastCommitSha(
  repo: string,
  token: string | null,
  pathPrefix: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/commits?path=${encodeURIComponent(pathPrefix)}&per_page=1`,
      { headers: ghHeaders(token), cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ sha?: string }>;
    return typeof data[0]?.sha === "string" ? data[0].sha : null;
  } catch (e) {
    ragLog.warn("lastCommitSha failed", { repo, pathPrefix, err: errMsg(e) });
    return null;
  }
}

// ── File zones (brain repo) ────────────────────────────────────────────────────────
function fileZone(repo: string, token: string | null, zonePath: string): ZoneDescriptor {
  const zone = normalizeZonePath(zonePath);
  return {
    zonePath: zone,
    zoneType: "file",
    loadDocs: async () => (await collectZoneDocs(repo, token, zone)).docs,
    currentCursor: async () => {
      const sha = await lastCommitSha(repo, token, zone);
      return sha ? { commitSha: sha } : {};
    },
  };
}

// ── Project zones (Supabase rows) ──────────────────────────────────────────────────
function projectMemoryZone(ownerId: string, projectId: string): ZoneDescriptor {
  const zonePath = `project/${projectId}/memory`;
  return {
    zonePath,
    zoneType: "project",
    loadDocs: async () => {
      const res = await listProjectMemory(projectId, ownerId);
      if (!res.ok) return [];
      return res.data.map((m) => ({ docPath: `${zonePath}/${m.id}`, text: m.body }));
    },
    currentCursor: async () => {
      const res = await listProjectMemory(projectId, ownerId);
      // listProjectMemory orders created_at.desc, so the first row is the newest.
      if (!res.ok || res.data.length === 0) return {};
      return { rowTimestamp: res.data[0].created_at };
    },
  };
}

function projectReferencesZone(ownerId: string, projectId: string): ZoneDescriptor {
  const zonePath = `project/${projectId}/references`;
  return {
    zonePath,
    zoneType: "project",
    loadDocs: async () => {
      const res = await listProjectReferences(projectId, ownerId);
      if (!res.ok) return [];
      return res.data.map((r) => ({ docPath: `${zonePath}/${r.id}`, text: r.content_text }));
    },
    currentCursor: async () => {
      const res = await listProjectReferences(projectId, ownerId);
      if (!res.ok || res.data.length === 0) return {};
      return { rowTimestamp: res.data[0].created_at };
    },
  };
}

/**
 * Resolves a `zonePath` back to its descriptor (the cron's reverse map). `brainRepo`/`token` are
 * required for the brain-backed file zones; project zones read Supabase directly. Returns null for an
 * unrecognized zone path (or a file zone with no brain repo).
 */
export function descriptorForZonePath(
  ownerId: string,
  zonePath: string,
  brainRepo: string | null,
  token: string | null,
): ZoneDescriptor | null {
  const zone = normalizeZonePath(zonePath);

  const projMem = zone.match(/^project\/([^/]+)\/memory$/);
  if (projMem) return projectMemoryZone(ownerId, projMem[1]);
  const projRef = zone.match(/^project\/([^/]+)\/references$/);
  if (projRef) return projectReferencesZone(ownerId, projRef[1]);

  // Everything else is a brain-repo file zone (memory, personas/<slug>/knowledge, …).
  return brainRepo ? fileZone(brainRepo, token, zone) : null;
}

/**
 * Pure change-detection gate (unit-tested): should the cron rebuild this zone?
 *   - a never-built ('idle') zone is always built (it has no index yet);
 *   - a built zone is rebuilt only when its current cursor differs from the stored one;
 *   - an indeterminate current cursor (GitHub error, empty zone) on a built zone is "no change" —
 *     never churn an index when we can't confirm the source actually moved.
 */
export function zoneCursorChanged(
  stored: RagChangeCursor,
  current: RagChangeCursor,
  isIdle: boolean,
): boolean {
  if (isIdle) return true;
  const currentValue = current.commitSha ?? current.rowTimestamp ?? null;
  if (currentValue === null) return false;
  const storedValue = stored.commitSha ?? stored.rowTimestamp ?? null;
  return storedValue !== currentValue;
}
