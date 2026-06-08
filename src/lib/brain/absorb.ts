// absorb.ts — the single canonical pipeline that turns an uploaded file into brain content.
//
// Every capture surface (the Documents upload zone, the chat share-card upload, and the iOS
// share-extension triage) funnels through here so they all behave identically: the raw bytes
// land in assets/<filename> (so Documents reflects them and the agent can read them) and,
// when an Anthropic key is present and the type is machine-readable, Claude absorbs the file
// into a memory/*.md entry — both committed together in one brain-repo commit.
//
// Public API:
//   assetPathFor(fileName)       → the canonical assets/ path for a filename
//   persistAssetBytes(...)       → commit raw bytes to assets/ (no absorption)
//   absorbToMemory(...)          → the full pipeline: extract + persist asset + write memory
//
// Plus the shared upload-gating constants/helpers (isAllowedUploadType, canAbsorbType,
// uploadTypeLabel, MAX_UPLOAD_BYTES) so each surface validates types the same way.

// ─── Type gating ─────────────────────────────────────────────────────────────────

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// Types Claude can natively read for absorption.
const CLAUDE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const CLAUDE_DOC_TYPES = new Set(["application/pdf"]);
const TEXT_TYPES = new Set(["text/plain", "text/markdown"]);

const ALLOWED_TYPES = new Set([
  ...CLAUDE_IMAGE_TYPES,
  ...CLAUDE_DOC_TYPES,
  ...TEXT_TYPES,
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG image",
  "image/jpeg": "JPEG image",
  "image/webp": "WebP image",
  "image/heic": "HEIC image",
  "image/heif": "HEIF image",
  "text/plain": "text file",
  "text/markdown": "Markdown file",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word doc",
};

/** True when the type is accepted for upload (storable, even if not absorbable). */
export function isAllowedUploadType(mimeType: string): boolean {
  return ALLOWED_TYPES.has(mimeType);
}

/** True when Claude can read the type and absorb it into memory (PDF / image / text). */
export function canAbsorbType(mimeType: string): boolean {
  return (
    CLAUDE_DOC_TYPES.has(mimeType) ||
    CLAUDE_IMAGE_TYPES.has(mimeType) ||
    TEXT_TYPES.has(mimeType)
  );
}

/** Human-friendly label for a mime type, falling back to the raw type. */
export function uploadTypeLabel(mimeType: string): string {
  return TYPE_LABELS[mimeType] ?? mimeType;
}

// ─── GitHub plumbing ───────────────────────────────────────────────────────────

type GhRef = { object: { sha: string } };
type GhCommit = { tree: { sha: string } };
type GhBlob = { sha: string };
type GhTree = { sha: string };
type GhNewCommit = { sha: string };
type GhRepo = { default_branch: string };
type GhFileContent = { encoding: string; content: string };

export type CommitFile = { content: string; encoding: "base64" | "utf-8" };

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "pocket-agent/1.0",
    "Content-Type": "application/json",
  };
}

async function getDefaultBranch(
  repo: string,
  token: string,
): Promise<{ ok: true; branch: string } | { ok: false; error: string }> {
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: ghHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, error: `GitHub returned ${res.status} fetching repo info.` };
  const data = (await res.json()) as GhRepo;
  return { ok: true, branch: data.default_branch };
}

async function fetchExistingFile(
  repo: string,
  token: string,
  path: string,
): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: ghHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as GhFileContent;
  if (data.encoding === "base64") {
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
  }
  return data.content ?? null;
}

async function createBlob(
  repo: string,
  token: string,
  content: string,
  encoding: "base64" | "utf-8",
): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({ content, encoding }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as GhBlob;
  return data.sha;
}

/**
 * Commits a set of files to the brain repo in a single commit. Resolves the default branch
 * itself so callers only pass repo + token. Returns the new commit SHA on success.
 */
async function commitFiles(
  repo: string,
  token: string,
  files: Map<string, CommitFile>,
  message: string,
): Promise<{ ok: true; sha: string } | { ok: false; error: string }> {
  const branchResult = await getDefaultBranch(repo, token);
  if (!branchResult.ok) return { ok: false, error: branchResult.error };
  const branch = branchResult.branch;

  const refRes = await fetch(
    `https://api.github.com/repos/${repo}/git/refs/heads/${branch}`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (!refRes.ok) return { ok: false, error: `Could not read branch (${refRes.status}).` };
  const refData = (await refRes.json()) as GhRef;
  const headSha = refData.object.sha;

  const commitRes = await fetch(
    `https://api.github.com/repos/${repo}/git/commits/${headSha}`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (!commitRes.ok) return { ok: false, error: "Could not fetch base commit." };
  const commitData = (await commitRes.json()) as GhCommit;
  const baseTreeSha = commitData.tree.sha;

  type TreeItem = { path: string; mode: "100644"; type: "blob"; sha: string | null };
  const treeItems: TreeItem[] = [];

  for (const [path, { content, encoding }] of files) {
    const sha = await createBlob(repo, token, content, encoding);
    if (!sha) return { ok: false, error: `Failed to create blob for ${path}.` };
    treeItems.push({ path, mode: "100644", type: "blob", sha });
  }

  const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    cache: "no-store",
  });
  if (!treeRes.ok) return { ok: false, error: `Failed to create git tree (${treeRes.status}).` };
  const treeData = (await treeRes.json()) as GhTree;

  const now = new Date().toISOString();
  const newCommitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({
      message,
      tree: treeData.sha,
      parents: [headSha],
      author: { name: repo.split("/")[0], email: "noreply@github.com", date: now },
    }),
    cache: "no-store",
  });
  if (!newCommitRes.ok) {
    return { ok: false, error: `Failed to create commit (${newCommitRes.status}).` };
  }
  const newCommitData = (await newCommitRes.json()) as GhNewCommit;

  const updateRes = await fetch(
    `https://api.github.com/repos/${repo}/git/refs/heads/${branch}`,
    {
      method: "PATCH",
      headers: ghHeaders(token),
      body: JSON.stringify({ sha: newCommitData.sha, force: false }),
      cache: "no-store",
    },
  );
  if (!updateRes.ok) return { ok: false, error: `Failed to update ref (${updateRes.status}).` };
  return { ok: true, sha: newCommitData.sha };
}

// ─── Asset path + raw-bytes persist ──────────────────────────────────────────────

/** The canonical assets/ path for a filename, sanitized to a safe, bounded name. */
export function assetPathFor(fileName: string): string {
  const safeName =
    fileName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_{2,}/g, "_")
      .slice(0, 200) || "upload";
  return `assets/${safeName}`;
}

/**
 * Commits raw file bytes to assets/<filename> in the brain repo, no absorption. Used when
 * the file can't be absorbed (no key, unreadable type, or extraction failed) but should
 * still land in Documents.
 */
export async function persistAssetBytes(params: {
  repo: string;
  token: string;
  fileName: string;
  base64: string;
  commitMessage?: string;
}): Promise<{ ok: true; sha: string; assetPath: string } | { ok: false; error: string }> {
  const assetPath = assetPathFor(params.fileName);
  const files = new Map<string, CommitFile>([[assetPath, { content: params.base64, encoding: "base64" }]]);
  const result = await commitFiles(
    params.repo,
    params.token,
    files,
    params.commitMessage ?? `Pocket Agent — store ${assetPath.split("/").pop() ?? ""}`,
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, sha: result.sha, assetPath };
}

/**
 * Commit a UTF-8 text file to an arbitrary path in the brain repo (creating or overwriting
 * it in a single commit). Used by the inbound-email BCC handler to log a touchpoint to
 * brain/email-log/… — a brain capture that isn't an uploaded asset or a memory entry.
 */
export async function commitBrainTextFile(params: {
  repo: string;
  token: string;
  path: string;
  content: string;
  commitMessage: string;
}): Promise<{ ok: true; sha: string } | { ok: false; error: string }> {
  const files = new Map<string, CommitFile>([[params.path, { content: params.content, encoding: "utf-8" }]]);
  const result = await commitFiles(params.repo, params.token, files, params.commitMessage);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, sha: result.sha };
}

/**
 * Hard-delete a file from the brain repo via the GitHub Contents API (resolve its blob sha,
 * then DELETE). Backs the privacy-page "Purge from brain" button. A missing file is treated
 * as already-gone (idempotent success).
 */
export async function deleteBrainFile(params: {
  repo: string;
  token: string;
  path: string;
  commitMessage: string;
}): Promise<{ ok: true; deleted: boolean } | { ok: false; error: string }> {
  const branchResult = await getDefaultBranch(params.repo, params.token);
  if (!branchResult.ok) return { ok: false, error: branchResult.error };

  const metaRes = await fetch(
    `https://api.github.com/repos/${params.repo}/contents/${params.path}?ref=${branchResult.branch}`,
    { headers: ghHeaders(params.token), cache: "no-store" },
  );
  if (metaRes.status === 404) return { ok: true, deleted: false };
  if (!metaRes.ok) return { ok: false, error: `Could not read file to delete (${metaRes.status}).` };
  const meta = (await metaRes.json()) as { sha?: string };
  if (!meta.sha) return { ok: false, error: "File metadata missing sha." };

  const delRes = await fetch(`https://api.github.com/repos/${params.repo}/contents/${params.path}`, {
    method: "DELETE",
    headers: ghHeaders(params.token),
    body: JSON.stringify({ message: params.commitMessage, sha: meta.sha, branch: branchResult.branch }),
    cache: "no-store",
  });
  if (!delRes.ok) return { ok: false, error: `Failed to delete file (${delRes.status}).` };
  return { ok: true, deleted: true };
}

// ─── Claude extraction ───────────────────────────────────────────────────────────

const ABSORPTION_PROMPT = `You are absorbing a file uploaded by a business owner into their AI agent's memory repository (their "brain").

Carefully read/analyze all content in this file, then return ONLY valid JSON in this exact format — no markdown, no explanation, just the JSON object:
{
  "summary": "1-2 sentence plain English description of what you found and what you absorbed",
  "memoryType": "user OR feedback OR project OR reference",
  "memoryName": "short-kebab-case-slug",
  "memoryDescription": "one-line description of what this memory contains",
  "memoryBody": "the full memory content in markdown — thorough, structured, extracting all meaningful business details"
}

memoryType guidelines:
- user: business identity, services offered, who they serve, company info, team, pricing
- feedback: working style, preferences, communication style, how they want things done, voice/tone
- project: current projects, priorities, goals, decisions, timelines, clients, deals
- reference: tools, vendors, resources, contact info, external references, credentials

Extract everything useful. The agent reads this memory before every reply, so thoroughness directly helps the business owner.`;

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

type ExtractionResult =
  | {
      ok: true;
      summary: string;
      memoryPath: string;
      memoryName: string;
      memoryType: string;
      memoryBody: string;
      memoryDescription: string;
    }
  | { ok: false; error: string };

async function extractContent(
  apiKey: string,
  mimeType: string,
  buffer: Buffer,
  base64: string,
): Promise<ExtractionResult> {
  let content: ContentBlock[];

  if (CLAUDE_DOC_TYPES.has(mimeType)) {
    content = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
      { type: "text", text: ABSORPTION_PROMPT },
    ];
  } else if (CLAUDE_IMAGE_TYPES.has(mimeType)) {
    content = [
      { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
      { type: "text", text: ABSORPTION_PROMPT },
    ];
  } else if (TEXT_TYPES.has(mimeType)) {
    const text = buffer.toString("utf-8");
    content = [{ type: "text", text: `${ABSORPTION_PROMPT}\n\n--- FILE CONTENT ---\n${text}` }];
  } else {
    return { ok: false, error: "File type cannot be read by the AI. Convert to PDF or PNG." };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content }],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    if (res.status === 401) return { ok: false, error: "Invalid Anthropic API key." };
    if (res.status === 429) return { ok: false, error: "Anthropic rate limit hit. Try again in a moment." };
    return { ok: false, error: `Claude API error (${res.status}): ${errText.slice(0, 120)}` };
  }

  type AnthropicResponse = { content: Array<{ type: string; text?: string }> };
  const data = (await res.json()) as AnthropicResponse;
  const text = data.content.find((c) => c.type === "text")?.text ?? "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { ok: false, error: "Claude returned an unexpected format." };

  type ParsedExtraction = {
    summary?: string;
    memoryType?: string;
    memoryName?: string;
    memoryDescription?: string;
    memoryBody?: string;
  };

  let parsed: ParsedExtraction;
  try {
    parsed = JSON.parse(jsonMatch[0]) as ParsedExtraction;
  } catch {
    return { ok: false, error: "Could not parse Claude's response." };
  }

  const memType = (["user", "feedback", "project", "reference"] as const).includes(
    parsed.memoryType as "user" | "feedback" | "project" | "reference",
  )
    ? (parsed.memoryType as "user" | "feedback" | "project" | "reference")
    : "user";

  const memName =
    (parsed.memoryName ?? "uploaded-content")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "uploaded-content";

  return {
    ok: true,
    summary: parsed.summary ?? "Content absorbed into your brain.",
    memoryPath: `memory/${memType}_${memName}.md`,
    memoryName: memName,
    memoryType: memType,
    memoryDescription: (parsed.memoryDescription ?? "Uploaded content").replace(/\n/g, " "),
    memoryBody: parsed.memoryBody ?? "",
  };
}

function buildFrontmatter(name: string, description: string, type: string): string {
  return `---\nname: ${name}\ndescription: ${description}\nmetadata:\n  type: ${type}\n---\n`;
}

// ─── Full pipeline ───────────────────────────────────────────────────────────────

export type AbsorbInput = {
  repo: string;
  token: string;
  /** Null when the owner hasn't connected an Anthropic key — the asset is still stored. */
  anthropicApiKey: string | null;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

export type AbsorbResult =
  | {
      ok: true;
      /** Bytes committed to assets/. */
      stored: boolean;
      /** A memory/*.md entry was written from the file's content. */
      absorbed: boolean;
      assetPath: string;
      memoryPath: string | null;
      summary: string | null;
      message: string;
      /** Absorbable type but no Anthropic key connected. */
      noKey: boolean;
      /** Absorption was attempted but failed; the asset was still stored. */
      partial: boolean;
    }
  | { ok: false; status: number; error: string };

/**
 * The canonical capture pipeline. Stores the raw bytes in assets/<filename> and, when an
 * Anthropic key is present and the type is machine-readable, absorbs the file into a
 * memory/*.md entry (creating it or appending below a dated divider if it already exists) —
 * both in a single commit. Falls back to an asset-only commit for the no-key, unreadable, or
 * extraction-failed cases so the file always reaches Documents.
 */
export async function absorbToMemory(input: AbsorbInput): Promise<AbsorbResult> {
  const { repo, token, anthropicApiKey, fileName, mimeType, buffer } = input;
  const base64 = buffer.toString("base64");
  const assetPath = assetPathFor(fileName);
  const safeName = assetPath.split("/").pop() ?? fileName;
  const fileLabel = uploadTypeLabel(mimeType);

  // No Anthropic key → store the asset, tell the owner to add a key.
  if (!anthropicApiKey) {
    const stored = await persistAssetBytes({
      repo,
      token,
      fileName,
      base64,
      commitMessage: `Pocket Agent — store ${safeName}`,
    });
    if (!stored.ok) return { ok: false, status: 502, error: stored.error };
    return {
      ok: true,
      stored: true,
      absorbed: false,
      assetPath,
      memoryPath: null,
      summary: null,
      noKey: true,
      partial: false,
      message: `${fileLabel} stored in your brain. Add your Anthropic API key in Settings to have the agent absorb it into memory.`,
    };
  }

  // Type can't be absorbed even with a key (HEIC, DOCX) → store only.
  if (!canAbsorbType(mimeType)) {
    const stored = await persistAssetBytes({
      repo,
      token,
      fileName,
      base64,
      commitMessage: `Pocket Agent — store ${safeName}`,
    });
    if (!stored.ok) return { ok: false, status: 502, error: stored.error };
    return {
      ok: true,
      stored: true,
      absorbed: false,
      assetPath,
      memoryPath: null,
      summary: null,
      noKey: false,
      partial: false,
      message: `${fileLabel} stored in your brain repo. Convert to PDF or PNG for the agent to absorb it into memory.`,
    };
  }

  // Extract + absorb via Claude.
  const extraction = await extractContent(anthropicApiKey, mimeType, buffer, base64);

  if (!extraction.ok) {
    // Still store the asset even if extraction fails.
    const stored = await persistAssetBytes({
      repo,
      token,
      fileName,
      base64,
      commitMessage: `Pocket Agent — store ${safeName}`,
    });
    if (!stored.ok) return { ok: false, status: 502, error: stored.error };
    return {
      ok: true,
      stored: true,
      absorbed: false,
      assetPath,
      memoryPath: null,
      summary: null,
      noKey: false,
      partial: true,
      message: `File stored but extraction failed: ${extraction.error}`,
    };
  }

  // If the target memory file already exists, append below a divider instead of overwriting.
  const existingMemory = await fetchExistingFile(repo, token, extraction.memoryPath);

  let finalMemoryContent: string;
  if (existingMemory) {
    const uploadDate = new Date().toISOString().slice(0, 10);
    finalMemoryContent =
      existingMemory.trimEnd() +
      `\n\n---\n\n*Absorbed from upload (${uploadDate}):*\n\n${extraction.memoryBody.trim()}\n`;
  } else {
    finalMemoryContent =
      buildFrontmatter(extraction.memoryName, extraction.memoryDescription, extraction.memoryType) +
      "\n" +
      extraction.memoryBody.trim() +
      "\n";
  }

  const filesToCommit = new Map<string, CommitFile>([
    [assetPath, { content: base64, encoding: "base64" }],
    [extraction.memoryPath, { content: finalMemoryContent, encoding: "utf-8" }],
  ]);

  const commitResult = await commitFiles(
    repo,
    token,
    filesToCommit,
    `Pocket Agent — absorb ${safeName} into brain`,
  );
  if (!commitResult.ok) return { ok: false, status: 502, error: commitResult.error };

  return {
    ok: true,
    stored: true,
    absorbed: true,
    assetPath,
    memoryPath: extraction.memoryPath,
    summary: extraction.summary,
    noKey: false,
    partial: false,
    message: extraction.summary,
  };
}
