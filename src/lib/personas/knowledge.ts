// knowledge.ts — a persona's knowledge zone (RAG source) lives at
// `personas/<slug>/knowledge/` in the owner's brain repo. RAG strategy (PA-PERSONA
// decision): bounded file-listing-and-read of every text file in the zone, NOT vector
// search — PA has no embedding/vector infra, zones are small owner-curated playbooks,
// and reading all of them keeps answers grounded with zero new infrastructure. Every
// read is wrapped by ContainmentGuard (assertPathInZone) so a persona can only ever
// pull files from its own declared zone.

import {
  commitMemoryFile,
  deleteRepoFile,
  fetchFileContent,
  formatMemoryBlocksForPrompt,
  listRepoTree,
  type MemoryBlock,
} from "@/lib/pa-brain";
import {
  assertPathInZone,
  filterPathsToZone,
  type ZoneConfig,
} from "@/lib/brain/containment-guard";
import {
  personaKnowledgeDir,
  personaZoneKey,
  type PersonaRow,
} from "./types";
import { queryRag } from "@/lib/rag/query";
import { shouldUseVector } from "@/lib/rag/types";

// Bounds so a chat request never reads an unbounded amount of context.
export const KNOWLEDGE_MAX_FILES = 50;
export const KNOWLEDGE_MAX_CHARS = 180_000;

// Text file extensions we read into context. Uploads of PDF/DOCX/images are converted
// to markdown at upload time, so the zone only ever contains text by chat time.
const TEXT_EXTS = [".md", ".txt"];

function isTextPath(path: string): boolean {
  return TEXT_EXTS.some((ext) => path.toLowerCase().endsWith(ext));
}

export type KnowledgeFile = {
  name: string;
  path: string;
  sizeBytes: number;
};

type GhContentItem = {
  name?: string;
  path?: string;
  type?: string;
  size?: number;
};

function ghHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Lists every file currently in a persona's knowledge directory (with sizes). */
export async function listKnowledgeFiles(
  repo: string,
  token: string | null,
  slug: string,
): Promise<KnowledgeFile[]> {
  const dir = personaKnowledgeDir(slug);
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${dir}`, {
    headers: ghHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) return []; // 404 → no knowledge uploaded yet
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return (data as GhContentItem[])
    .filter((f) => f.type === "file" && typeof f.path === "string")
    .map((f) => ({
      name: f.name ?? "",
      path: f.path ?? "",
      sizeBytes: typeof f.size === "number" ? f.size : 0,
    }));
}

export type LoadedKnowledge = {
  markup: string;
  fileCount: number;
  // Paths that resolved to a DIFFERENT zone than the persona's — a containment
  // violation. Should always be empty; non-empty means the zone config is wrong and
  // is surfaced to the owner (digest + Sentry) per SPEC Success Criterion #2.
  blocked: { path: string; zone: string }[];
};

/**
 * Loads the persona's knowledge for a chat turn. Lists the repo tree, filters to the
 * persona's zone via ContainmentGuard, then reads each allowed file — asserting zone
 * membership again immediately before each read (belt-and-suspenders). Throws
 * ContainmentBlockedError if a read path ever escapes the zone.
 *
 * RAG (Personas SPEC §3.5): when the caller passes the visitor's `query` + the persona owner and the
 * zone is above the ~100-doc / ~50k-token threshold, the turbovec index narrows the read set to the
 * top-N relevant files instead of reading the whole zone. Below threshold (or before the index is
 * built) it reads all allowed files as before — queryRag returns a `fallback` signal and nothing
 * changes. The narrowed paths are still drawn from `allowed`, so ContainmentGuard is never widened.
 */
export async function loadKnowledgeForChat(
  repo: string,
  token: string | null,
  persona: PersonaRow,
  zoneConfig: ZoneConfig,
  options?: { ownerId?: string; query?: string; topN?: number },
): Promise<LoadedKnowledge> {
  const zoneKey = persona.knowledge_zone_key || personaZoneKey(persona.slug);
  const dirPrefix = `${personaKnowledgeDir(persona.slug)}/`;

  const tree = await listRepoTree(repo, token);
  const candidatePaths = tree
    .filter((e) => e.type === "blob" && e.path.startsWith(dirPrefix) && isTextPath(e.path))
    .map((e) => e.path);

  const { allowed, blocked } = filterPathsToZone(candidatePaths, zoneConfig, zoneKey);
  const capped = await narrowKnowledgePaths(allowed, persona, options);

  const blocks: MemoryBlock[] = [];
  let totalChars = 0;
  for (const path of capped) {
    // Hard guard before every individual read — this is the load-bearing line.
    assertPathInZone(path, zoneConfig, zoneKey);
    const content = await fetchFileContent(repo, path, token);
    if (!content) continue;
    const remaining = KNOWLEDGE_MAX_CHARS - totalChars;
    if (remaining <= 0) break;
    const clipped = content.length > remaining ? content.slice(0, remaining) : content;
    totalChars += clipped.length;
    blocks.push({ path, content: clipped });
  }

  return {
    markup: blocks.length ? formatMemoryBlocksForPrompt(blocks) : "",
    fileCount: blocks.length,
    blocked,
  };
}

// Default number of zone files the vector index narrows down to for a single chat turn.
const KNOWLEDGE_VECTOR_TOP_N = 12;

/**
 * Narrows the allowed zone files to read for this turn. Above the threshold, queryRag picks the
 * top-N relevant files (turbovec); the result is intersected with `allowed` so the zone guard is
 * never widened. Below threshold, before an index exists, or without a query/owner, returns the
 * first KNOWLEDGE_MAX_FILES allowed paths — the original read-all behavior.
 */
async function narrowKnowledgePaths(
  allowed: string[],
  persona: PersonaRow,
  options?: { ownerId?: string; query?: string; topN?: number },
): Promise<string[]> {
  const query = options?.query?.trim();
  const ownerId = options?.ownerId;
  // tokenCount is unknown here without reading every file; the doc count alone crosses the threshold
  // for the large zones turbovec targets, which is the case the narrowing exists for.
  if (!query || !ownerId || !shouldUseVector(allowed.length, 0)) {
    return allowed.slice(0, KNOWLEDGE_MAX_FILES);
  }

  const zonePath = personaKnowledgeDir(persona.slug);
  const rag = await queryRag({
    ownerId,
    zonePath,
    query,
    topN: options?.topN ?? KNOWLEDGE_VECTOR_TOP_N,
    docCount: allowed.length,
  });
  if (rag.source !== "turbovec" || rag.hits.length === 0) {
    return allowed.slice(0, KNOWLEDGE_MAX_FILES);
  }

  const allowedSet = new Set(allowed);
  const selected = rag.hits.map((h) => h.docPath).filter((p) => allowedSet.has(p));
  return selected.length > 0 ? selected.slice(0, KNOWLEDGE_MAX_FILES) : allowed.slice(0, KNOWLEDGE_MAX_FILES);
}

// ── Write side (wizard step 4 + Knowledge tab) ───────────────────────────────────────

/** Commits a single text knowledge file into the persona's zone. */
export async function writeKnowledgeFile(params: {
  repo: string;
  token: string;
  slug: string;
  filename: string;
  content: string;
}): Promise<{ ok: true; sha: string; path: string } | { ok: false; error: string }> {
  const path = `${personaKnowledgeDir(params.slug)}/${params.filename}`;
  const result = await commitMemoryFile({
    repo: params.repo,
    token: params.token,
    path,
    mode: "replace",
    content: params.content,
    commitMessage: `persona: add knowledge ${path}`,
  });
  if (!result.ok) return result;
  return { ok: true, sha: result.sha, path };
}

export async function removeKnowledgeFile(params: {
  repo: string;
  token: string;
  slug: string;
  filename: string;
}): Promise<{ ok: true; sha: string } | { ok: false; error: string }> {
  const path = `${personaKnowledgeDir(params.slug)}/${params.filename}`;
  return deleteRepoFile({
    repo: params.repo,
    token: params.token,
    path,
    commitMessage: `persona: remove knowledge ${path}`,
  });
}

/** Sanitizes an uploaded filename to a safe, zone-relative leaf name. */
export function safeKnowledgeFilename(original: string): string {
  const base = original.replace(/^.*[\\/]/, "").trim();
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "knowledge.md";
}

export { formatMemoryBlocksForPrompt };
