// zone-source.ts — read a brain-repo zone's documents for indexing. Both the build path
// (buildOrRefreshIndex callers + the daily cron) and the threshold check use this. Reads are
// structurally zone-bounded: only files whose path sits inside the normalized zone prefix are
// listed or read, so a build can never pull a doc from outside the zone into the index.

import { fetchFileContent, listRepoTree } from "@/lib/pa-brain";
import { normalizeZonePath } from "./types";
import type { RagBuildDoc } from "./client";

// Text file extensions we index. Uploads of PDF/DOCX/images are converted to markdown at upload
// time (persona knowledge flow), so a zone only ever holds text by index time.
const TEXT_EXTS = [".md", ".txt"];
// Caps so a build can't read an unbounded zone or embed a single giant file in full.
const MAX_ZONE_FILES = 2000;
const MAX_DOC_CHARS = 8_000;

function isTextPath(path: string): boolean {
  return TEXT_EXTS.some((ext) => path.toLowerCase().endsWith(ext));
}

function inZone(path: string, zone: string): boolean {
  return path === zone || path.startsWith(`${zone}/`);
}

/** Lists every text file path inside a zone (capped). Zone-bounded by construction. */
export async function listZoneTextFiles(
  repo: string,
  token: string | null,
  zonePath: string,
): Promise<string[]> {
  const zone = normalizeZonePath(zonePath);
  if (!zone) return [];
  const tree = await listRepoTree(repo, token);
  return tree
    .filter((e) => e.type === "blob" && isTextPath(e.path) && inZone(e.path, zone))
    .map((e) => e.path)
    .slice(0, MAX_ZONE_FILES);
}

export type ZoneCorpus = {
  docs: RagBuildDoc[];
  docCount: number;
  /** Rough corpus token estimate (~4 chars/token) for the vector-vs-grep threshold + catalog stamp. */
  tokenCount: number;
};

/**
 * Reads a zone's text files into `{ docPath, text }` docs ready for buildOrRefreshIndex, with a
 * corpus token estimate. Each read is asserted to be inside the zone before it happens.
 */
export async function collectZoneDocs(
  repo: string,
  token: string | null,
  zonePath: string,
): Promise<ZoneCorpus> {
  const zone = normalizeZonePath(zonePath);
  const paths = await listZoneTextFiles(repo, token, zone);

  const docs: RagBuildDoc[] = [];
  let tokenCount = 0;
  for (const path of paths) {
    if (!inZone(path, zone)) continue; // belt: never read outside the zone
    const content = await fetchFileContent(repo, path, token);
    if (!content || !content.trim()) continue;
    const text = content.length > MAX_DOC_CHARS ? content.slice(0, MAX_DOC_CHARS) : content;
    docs.push({ docPath: path, text });
    tokenCount += Math.max(1, Math.ceil(text.length / 4));
  }

  return { docs, docCount: docs.length, tokenCount };
}
