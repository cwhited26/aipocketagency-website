// Brain Map — Folders mode graph extraction.
//
// The companion to graph.ts (Galaxy mode). Where Galaxy groups what PA knows by
// meaning (voice / customers / tools / decisions), Folders shows the brain the way
// it's actually stored: top-level folders and the key files inside them, wired by
// folder containment and [[wikilink]] cross-references. Same read path as Galaxy
// (one tree listing + a bounded set of markdown reads via pa-brain), same
// pure-function-over-RawFile shape so it's trivially testable.
//
// Reuses the frontmatter parser + excerpt/slug helpers from graph.ts so there's
// one implementation of each, not two.

import { listRepoTree, fetchFileContent } from "@/lib/pa-brain";
import {
  parseFrontmatter,
  firstParagraph,
  slugFromPath,
  humanizeSlug,
  type RawFile,
} from "@/lib/brain/graph";

// ── Public types ───────────────────────────────────────────────────────────────

export type FolderNodeKind = "folder" | "file";

// File-type buckets — drive the color legend and the "filter by file type" control.
export type BrainFileType =
  | "markdown"
  | "json"
  | "yaml"
  | "text"
  | "data"
  | "pdf"
  | "image"
  | "other";

export type FolderEdgeKind =
  | "containment" // a folder holds a file or sub-folder
  | "wikilink"; // a markdown file [[references]] another file

export type FolderNode = {
  id: string; // stable id — the repo path (folders included); "(root)" for the synthetic root
  label: string; // basename, humanized for the root
  kind: FolderNodeKind;
  fileType: BrainFileType | null; // null on folders
  topFolder: string; // top-level segment this node lives under (drives the folder filter)
  path: string | null; // real repo path for files/folders, null for the synthetic root
  date: string | null; // frontmatter created || last_reviewed (markdown only) — recency filter
  excerpt: string; // ≤2-line excerpt for the hover card
  isKey: boolean; // a key file (CLAUDE.md / MEMORY.md / voice spec / customer / project)
  childCount: number; // direct children — folder sizing
  degree: number; // total connected edges — layout sizing
};

export type FolderEdge = {
  source: string;
  target: string;
  kind: FolderEdgeKind;
};

export type FolderGraph = {
  nodes: FolderNode[];
  edges: FolderEdge[];
  topFolders: string[]; // distinct top-level folders, sorted — for the folder filter
  fileTypes: BrainFileType[]; // distinct file types present, ordered — for the type filter
  fileCount: number;
};

export type FolderTreeEntry = { path: string; type: "blob" | "tree" };

const ROOT_ID = "(root)";

// ── File-type classification ─────────────────────────────────────────────────────

export function fileTypeForPath(path: string): BrainFileType {
  const lower = path.toLowerCase();
  if (/\.mdx?$/.test(lower)) return "markdown";
  if (lower.endsWith(".json")) return "json";
  if (/\.ya?ml$/.test(lower)) return "yaml";
  if (lower.endsWith(".txt")) return "text";
  if (/\.(csv|tsv)$/.test(lower)) return "data";
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg|heic|heif)$/.test(lower)) return "image";
  return "other";
}

const FILE_TYPE_ORDER: BrainFileType[] = [
  "markdown",
  "json",
  "yaml",
  "text",
  "data",
  "pdf",
  "image",
  "other",
];

const FILE_TYPE_BLURB: Record<BrainFileType, string> = {
  markdown: "a note",
  json: "structured data",
  yaml: "config",
  text: "a text file",
  data: "a table",
  pdf: "a PDF",
  image: "an image",
  other: "a file",
};

// ── What we keep ─────────────────────────────────────────────────────────────────
//
// Folders are kept for structure; files are kept when they carry meaning. We skip
// version-control / dependency / scratch noise so a real brain stays readable.

function topSegment(path: string): string {
  const idx = path.indexOf("/");
  return idx === -1 ? ROOT_ID : path.slice(0, idx);
}

function isNoisePath(path: string): boolean {
  return (
    path.startsWith(".git/") ||
    path === ".git" ||
    /(^|\/)node_modules(\/|$)/.test(path) ||
    /(^|\/)\.DS_Store$/.test(path) ||
    // hidden top-level dirs (.github, .vscode, .proposed scratch) add no signal
    /^\.[^/]+\//.test(path)
  );
}

// A file worth its own node: every markdown note, plus the structured/text files an
// owner would recognize as content. Binary asset dumps under assets/ are left out —
// they're attachments, not knowledge, and there can be thousands of them.
function isFileWorthShowing(path: string, type: BrainFileType): boolean {
  if (isNoisePath(path)) return false;
  if (type === "markdown" || type === "text" || type === "data") return true;
  if (type === "json" || type === "yaml") return !path.startsWith("assets/");
  // pdf / image / other: only when they're not part of a bulk asset folder
  return !path.startsWith("assets/") && !/(^|\/)attachments\//.test(path);
}

// ── Key-file detection ───────────────────────────────────────────────────────────
//
// The files an owner reads first: the agent's instructions, the memory index, the
// voice spec, anyone/anything about their customers, and their projects/decisions.

const KEY_BASENAMES = new Set([
  "claude.md",
  "memory.md",
  "agents.md",
  "readme.md",
]);

export function isKeyFile(path: string): boolean {
  const base = (path.split("/").pop() ?? path).toLowerCase();
  if (KEY_BASENAMES.has(base)) return true;
  // voice spec — voice/chase-spec.md and friends
  if (/^voice\//.test(path) && /-spec\.mdx?$/.test(base)) return true;
  if (/(^|\/)voice\//.test(path) && /spec/.test(base)) return true;
  // customers & people
  if (/customer|people|person|relationship|contact|prospect|voice[_-]?of[_-]?customer/i.test(path)) {
    return true;
  }
  // projects, products & the standing brain docs
  if (/^project_/i.test(base)) return true;
  if (/(^|\/)(projects|products)\//i.test(path)) return true;
  if (/decision[_-]?log|roadmap|change[_-]?log|current[_-]?state|feature[_-]?inventory/i.test(base)) {
    return true;
  }
  return false;
}

// ── Excerpt ─────────────────────────────────────────────────────────────────────

// A short hover excerpt: the frontmatter description or the first paragraph for
// markdown we read; a type-shaped one-liner for everything else.
function excerptFor(
  path: string,
  type: BrainFileType,
  content: string | null,
): { excerpt: string; date: string | null } {
  if (type === "markdown" && content) {
    const fm = parseFrontmatter(content);
    const body = fm.description ?? firstParagraph(content);
    const clipped = body.length > 160 ? `${body.slice(0, 160).trimEnd()}…` : body;
    return { excerpt: clipped || "A note in your brain.", date: fm.date };
  }
  return { excerpt: `${humanizeSlug(slugFromPath(path))} — ${FILE_TYPE_BLURB[type]}.`, date: null };
}

// ── Core builder (pure) ──────────────────────────────────────────────────────────

/**
 * Builds the Folders-mode graph from a flat tree listing plus the contents of any
 * markdown files (other types don't need content — they're shown by path + type).
 * Pure and deterministic so it's unit-testable without GitHub.
 */
export function buildFolderGraphFromTree(
  entries: FolderTreeEntry[],
  files: RawFile[],
  opts: { repoLabel?: string } = {},
): FolderGraph {
  const contentByPath = new Map(files.map((f) => [f.path, f.content]));
  const nodes: FolderNode[] = [];
  const nodeById = new Map<string, FolderNode>();
  const edges: FolderEdge[] = [];

  const addNode = (n: FolderNode): void => {
    if (nodeById.has(n.id)) return;
    nodeById.set(n.id, n);
    nodes.push(n);
  };

  // Synthetic root so the brain reads as one connected tree, not a scatter of
  // disconnected top-level folders.
  addNode({
    id: ROOT_ID,
    label: opts.repoLabel ? humanizeSlug(opts.repoLabel) : "Your brain",
    kind: "folder",
    fileType: null,
    topFolder: ROOT_ID,
    path: null,
    date: null,
    excerpt: "The root of everything your agent has learned.",
    isKey: false,
    childCount: 0,
    degree: 0,
  });

  // 1) Folder nodes — every tree entry that isn't noise.
  const folderPaths = new Set<string>();
  for (const e of entries) {
    if (e.type !== "tree") continue;
    if (isNoisePath(e.path)) continue;
    folderPaths.add(e.path);
    addNode({
      id: e.path,
      label: e.path.split("/").pop() ?? e.path,
      kind: "folder",
      fileType: null,
      topFolder: topSegment(e.path),
      path: e.path,
      date: null,
      excerpt: `Folder — ${e.path}`,
      isKey: false,
      childCount: 0,
      degree: 0,
    });
  }

  // 2) File nodes — markdown + recognizable content files.
  const fileSlugToId = new Map<string, string>(); // basename-without-ext → file id, for wikilink resolution
  for (const e of entries) {
    if (e.type !== "blob") continue;
    const type = fileTypeForPath(e.path);
    if (!isFileWorthShowing(e.path, type)) continue;
    const { excerpt, date } = excerptFor(e.path, type, contentByPath.get(e.path) ?? null);
    addNode({
      id: e.path,
      label: e.path.split("/").pop() ?? e.path,
      kind: "file",
      fileType: type,
      topFolder: topSegment(e.path),
      path: e.path,
      date,
      excerpt,
      isKey: isKeyFile(e.path),
      childCount: 0,
      degree: 0,
    });
    const slug = slugFromPath(e.path).toLowerCase();
    // First writer wins — keeps wikilink resolution stable when two folders hold
    // a same-named file (rare in a brain; the index/CLAUDE files are unique).
    if (!fileSlugToId.has(slug)) fileSlugToId.set(slug, e.path);
  }

  // 3) Containment edges — each node hangs off its parent folder (or the root).
  for (const n of nodes) {
    if (n.id === ROOT_ID || n.path === null) continue;
    const slash = n.path.lastIndexOf("/");
    const parentId =
      slash === -1 ? ROOT_ID : folderPaths.has(n.path.slice(0, slash)) ? n.path.slice(0, slash) : ROOT_ID;
    edges.push({ source: parentId, target: n.id, kind: "containment" });
    const parent = nodeById.get(parentId);
    if (parent) parent.childCount += 1;
  }

  // 4) Wikilink edges — [[slug]] references between markdown files.
  for (const f of files) {
    const sourceId = f.path;
    if (!nodeById.has(sourceId)) continue;
    const seen = new Set<string>();
    for (const m of f.content.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const targetSlug = m[1].trim().toLowerCase().replace(/\.mdx?$/, "");
      const targetId = fileSlugToId.get(targetSlug);
      if (!targetId || targetId === sourceId || seen.has(targetId)) continue;
      seen.add(targetId);
      edges.push({ source: sourceId, target: targetId, kind: "wikilink" });
    }
  }

  // 5) Degree counts for layout sizing.
  for (const e of edges) {
    const s = nodeById.get(e.source);
    const t = nodeById.get(e.target);
    if (s) s.degree += 1;
    if (t) t.degree += 1;
  }

  const topFolders = [...new Set(nodes.filter((n) => n.id !== ROOT_ID).map((n) => n.topFolder))].sort();
  const present = new Set(nodes.map((n) => n.fileType).filter((t): t is BrainFileType => t !== null));
  const fileTypes = FILE_TYPE_ORDER.filter((t) => present.has(t));

  return {
    nodes,
    edges,
    topFolders,
    fileTypes,
    fileCount: nodes.filter((n) => n.kind === "file").length,
  };
}

// ── Fetch-driven entry point ─────────────────────────────────────────────────────

// Only markdown needs its bytes read (for excerpts + wikilinks); every other file
// is shown from its path + type, so the read budget stays bounded to notes.
function shouldReadContent(path: string): boolean {
  if (!/\.mdx?$/i.test(path)) return false;
  return isFileWorthShowing(path, "markdown");
}

/**
 * Reads the owner's brain repo over the GitHub REST API and returns the Folders
 * graph. One tree listing + a bounded set of markdown reads. Returns an empty
 * graph on a missing repo rather than throwing — the surface renders its own
 * "connect a brain" state.
 */
export async function buildBrainFolderGraph(
  repo: string,
  token: string | null,
  opts: { maxFiles?: number } = {},
): Promise<FolderGraph> {
  const maxFiles = opts.maxFiles ?? 400;
  const tree = await listRepoTree(repo, token);
  const entries: FolderTreeEntry[] = tree.map((e) => ({ path: e.path, type: e.type }));

  const readable = entries
    .filter((e) => e.type === "blob" && shouldReadContent(e.path))
    .slice(0, maxFiles);

  const files = await Promise.all(
    readable.map(async (e) => ({
      path: e.path,
      content: await fetchFileContent(repo, e.path, token),
    })),
  );

  const repoLabel = repo.split("/").pop() ?? repo;
  return buildFolderGraphFromTree(
    entries,
    files.filter((f) => f.content.length > 0),
    { repoLabel },
  );
}
