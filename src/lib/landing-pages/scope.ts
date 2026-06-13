// scope.ts — brain-scope utilities for the Landing Page Builder (PA-LPB-7..9).
//
// A brain scope narrows copy-generation context from the owner's entire brain to a single
// project or client folder. Null / "root" means the owner's personal brain — the existing
// behaviour, unchanged. The helpers here are the new entry points; the existing
// buildMemoryBlocks loader in pa-brain.ts is untouched.

import { listRepoTree, fetchFileContent, buildMemoryBlocks } from "@/lib/pa-brain";
import type { MemoryBlock } from "@/lib/pa-brain";

// ── Scope signals ─────────────────────────────────────────────────────────────────────────────────

// A directory qualifies as a project/client scope if ANY ONE of these is present at its root.
const SCOPE_SIGNAL_FILES = ["CLAUDE.md", "brand.md", "brand.json"] as const;
type ScopeSignalFile = (typeof SCOPE_SIGNAL_FILES)[number];
type ScopeSignal = ScopeSignalFile | "memory/";

// ── sanitizeScope ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validates and normalises a raw brain scope string from untrusted input.
 *
 * Returns the sanitised repo-relative path (trailing slash stripped) on success, or null when
 * the input is null, empty, or the literal "root".
 *
 * Throws on parent traversal or a leading slash — fail loud, fail early.
 */
export function sanitizeScope(raw: string | null | undefined): string | null {
  if (raw == null || raw === "" || raw === "root") return null;

  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  if (trimmed.includes("..")) {
    throw new Error(`Invalid brain scope — parent traversal not allowed: "${trimmed}"`);
  }
  if (trimmed.startsWith("/")) {
    throw new Error(`Invalid brain scope — must be repo-relative (no leading slash): "${trimmed}"`);
  }
  // Reject file paths: the final segment contains a dot.
  const lastSegment = trimmed.split("/").pop() ?? "";
  if (lastSegment.includes(".")) {
    throw new Error(`Invalid brain scope — must be a directory, not a file: "${trimmed}"`);
  }

  return trimmed;
}

// ── ProjectFolder ─────────────────────────────────────────────────────────────────────────────────

export type ProjectFolder = {
  /** Repo-relative directory path, e.g. "customers/valley-roofing". */
  path: string;
  /** Display name: the last path segment, humanised. */
  name: string;
  /** The signals found in the directory root (what makes it qualify). */
  signals: ScopeSignal[];
  /** Hex colour from brand.json `color`/`primaryColor`/`brandColor`, if present. */
  brandColor: string | null;
  /** ISO date — null in v1 (fetching per-folder commit dates requires extra API calls). */
  lastChangedAt: string | null;
};

function humanise(segment: string): string {
  return segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isHex(s: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(s);
}

function extractBrandColor(brandJson: string): string | null {
  try {
    const obj = JSON.parse(brandJson) as Record<string, unknown>;
    for (const key of ["color", "primaryColor", "brandColor", "primary", "brand_color"]) {
      const v = obj[key];
      if (typeof v === "string" && isHex(v)) return v;
    }
  } catch {
    // malformed JSON — not an error condition here
  }
  return null;
}

/**
 * Walks the owner's brain repo and returns every directory whose root contains at least one
 * scope signal (CLAUDE.md, brand.md, brand.json, or a memory/ subdirectory). One recursive-tree
 * API call; any GitHub failure degrades to [].
 */
export async function discoverProjectFolders(
  brainRepo: string,
  githubToken: string | null,
): Promise<ProjectFolder[]> {
  const tree = await listRepoTree(brainRepo, githubToken);
  if (!tree.length) return [];

  const signalMap = new Map<string, Set<ScopeSignal>>();

  for (const entry of tree) {
    const segs = entry.path.split("/");
    if (entry.type === "blob" && segs.length >= 2) {
      const dir = segs.slice(0, -1).join("/");
      const filename = segs[segs.length - 1] as ScopeSignalFile;
      if ((SCOPE_SIGNAL_FILES as readonly string[]).includes(filename)) {
        if (!signalMap.has(dir)) signalMap.set(dir, new Set());
        signalMap.get(dir)!.add(filename);
      }
    } else if (entry.type === "tree" && segs.length >= 2 && segs[segs.length - 1] === "memory") {
      const dir = segs.slice(0, -1).join("/");
      if (!signalMap.has(dir)) signalMap.set(dir, new Set());
      signalMap.get(dir)!.add("memory/");
    }
  }

  const qualifying: ProjectFolder[] = [];

  for (const [dirPath, signals] of signalMap.entries()) {
    let brandColor: string | null = null;
    if (signals.has("brand.json")) {
      const raw = await fetchFileContent(brainRepo, `${dirPath}/brand.json`, githubToken);
      if (raw) brandColor = extractBrandColor(raw);
    }
    qualifying.push({
      path: dirPath,
      name: humanise(dirPath.split("/").pop() ?? dirPath),
      signals: [...signals],
      brandColor,
      lastChangedAt: null,
    });
  }

  qualifying.sort((a, b) => {
    const d = a.path.split("/").length - b.path.split("/").length;
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });

  return qualifying;
}

// ── buildScopedMemoryBlocks ────────────────────────────────────────────────────────────────────────

/**
 * The scoped variant of the brain memory loader (PA-LPB-8).
 *
 * - Null / "root" → passthrough to the existing buildMemoryBlocks (zero behaviour change for all
 *   existing rows and callers).
 * - A real scope path → loads only files inside that subtree: CLAUDE.md, MEMORY.md, brand.md,
 *   brand.json, memory/ entries, voice/ entries.
 * - Missing scope folder → returns [] (degrade clean; copy generator fills sections with labeled
 *   placeholders per PA-LPB-3).
 */
export async function buildScopedMemoryBlocks(
  brainRepo: string,
  githubToken: string | null,
  scope?: string | null,
): Promise<MemoryBlock[]> {
  if (!scope || scope === "root") {
    return buildMemoryBlocks(brainRepo, githubToken);
  }

  const tree = await listRepoTree(brainRepo, githubToken);
  if (!tree.length) return [];

  const prefix = scope.replace(/\/$/, "") + "/";
  const wantedPaths: string[] = [];

  for (const entry of tree) {
    if (entry.type !== "blob" || !entry.path.startsWith(prefix)) continue;
    const rel = entry.path.slice(prefix.length);
    if (
      rel === "CLAUDE.md" ||
      rel === "MEMORY.md" ||
      rel === "brand.md" ||
      rel === "brand.json" ||
      rel.startsWith("memory/") ||
      rel.startsWith("voice/")
    ) {
      wantedPaths.push(entry.path);
    }
  }

  if (!wantedPaths.length) return [];

  return Promise.all(
    wantedPaths.map(async (path) => ({
      path,
      content: await fetchFileContent(brainRepo, path, githubToken),
    })),
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Human label for a scope path, used in the README provenance line and the UI.
 * Null / "root" → "personal".
 */
export function scopeLabel(scope: string | null | undefined): string {
  if (!scope || scope === "root") return "personal";
  return humanise(scope.split("/").pop() ?? scope);
}

/**
 * Returns the `domain` string from the scope's brand.json, if one exists. Used by the build flow
 * to propose an attachDomain step for scoped pages (PA-LPB-9 locked answer #4). Never throws.
 */
export async function readScopeBrandDomain(
  brainRepo: string,
  githubToken: string | null,
  scope: string,
): Promise<string | null> {
  const raw = await fetchFileContent(brainRepo, `${scope}/brand.json`, githubToken);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const d = obj["domain"];
    return typeof d === "string" && d.trim() ? d.trim() : null;
  } catch {
    return null;
  }
}
