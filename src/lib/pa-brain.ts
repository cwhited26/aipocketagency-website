type GhContentsItem = {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
};

// ── Write helpers (used by the action executor) ───────────────────────────────

type GhRef = { object: { sha: string } };
type GhCommit = { tree: { sha: string } };
type GhBlob = { sha: string };
type GhTree = { sha: string };
type GhNewCommit = { sha: string };
type GhRepo = { default_branch: string };

function ghWriteHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "pocket-agent/1.0",
    "Content-Type": "application/json",
  };
}

/**
 * Commits a single memory file (memory/*.md) to the brain repo.
 * mode='append': reads existing content and appends below a datestamped divider.
 * mode='replace': overwrites the file with the provided content.
 * Returns the new commit SHA on success.
 */
export async function commitMemoryFile(params: {
  repo: string;
  token: string;
  path: string;
  mode: "append" | "replace";
  content: string;
  commitMessage: string;
}): Promise<{ ok: true; sha: string } | { ok: false; error: string }> {
  const { repo, token, path, mode, content, commitMessage } = params;
  const hdrs = ghWriteHeaders(token);

  const repoRes = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: hdrs,
    cache: "no-store",
  });
  if (!repoRes.ok) return { ok: false, error: `GitHub repo fetch failed (${repoRes.status}).` };
  const repoData = (await repoRes.json()) as GhRepo;
  const branch = repoData.default_branch;

  const refRes = await fetch(
    `https://api.github.com/repos/${repo}/git/refs/heads/${branch}`,
    { headers: hdrs, cache: "no-store" },
  );
  if (!refRes.ok) return { ok: false, error: `Could not read branch ref (${refRes.status}).` };
  const refData = (await refRes.json()) as GhRef;
  const headSha = refData.object.sha;

  const baseCommitRes = await fetch(
    `https://api.github.com/repos/${repo}/git/commits/${headSha}`,
    { headers: hdrs, cache: "no-store" },
  );
  if (!baseCommitRes.ok) return { ok: false, error: "Could not fetch base commit." };
  const baseCommitData = (await baseCommitRes.json()) as GhCommit;
  const baseTreeSha = baseCommitData.tree.sha;

  let finalContent: string;
  if (mode === "append") {
    const existing = await fetchFileContent(repo, path, token);
    const date = new Date().toISOString().slice(0, 10);
    finalContent = existing
      ? `${existing.trimEnd()}\n\n---\n\n*Agent update (${date}):*\n\n${content.trim()}\n`
      : `${content.trim()}\n`;
  } else {
    finalContent = `${content.trim()}\n`;
  }

  const blobRes = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({ content: finalContent, encoding: "utf-8" }),
    cache: "no-store",
  });
  if (!blobRes.ok) return { ok: false, error: `Failed to create blob (${blobRes.status}).` };
  const blobData = (await blobRes.json()) as GhBlob;

  const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [{ path, mode: "100644", type: "blob", sha: blobData.sha }],
    }),
    cache: "no-store",
  });
  if (!treeRes.ok) return { ok: false, error: `Failed to create git tree (${treeRes.status}).` };
  const treeData = (await treeRes.json()) as GhTree;

  const now = new Date().toISOString();
  const newCommitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({
      message: commitMessage,
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
      headers: hdrs,
      body: JSON.stringify({ sha: newCommitData.sha, force: false }),
      cache: "no-store",
    },
  );
  if (!updateRes.ok) return { ok: false, error: `Failed to update ref (${updateRes.status}).` };

  return { ok: true, sha: newCommitData.sha };
}

type GhFileContent = {
  encoding: string;
  content: string;
};

export type MemoryBlock = {
  path: string;
  content: string;
};

export type Citation = {
  file: string;
  line: string;
};

export type AvailableFile = {
  name: string;
  path: string;
};

export async function listMemoryFiles(
  repo: string,
  token: string | null,
): Promise<AvailableFile[]> {
  const hdrs: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) hdrs.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/memory`, {
    headers: hdrs,
    cache: "no-store",
  });
  if (!res.ok) return [];
  const items = (await res.json()) as GhContentsItem[];
  return items
    .filter((f) => f.type === "file" && f.name.endsWith(".md"))
    .map((f) => ({ name: f.name, path: f.path }));
}

export async function fetchFileContent(
  repo: string,
  path: string,
  token: string | null,
): Promise<string> {
  const hdrs: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) hdrs.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: hdrs,
    cache: "no-store",
  });
  if (!res.ok) return "";
  const data = (await res.json()) as GhFileContent;
  if (data.encoding === "base64") {
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
  }
  return data.content ?? "";
}

// `filterPaths` lets a caller drop files before they're read — used by the
// ContainmentGuard to strip user-private paths out of LLM context. Passed as a plain
// callback (rather than importing the guard here) to avoid a circular import.
export async function buildMemoryBlocks(
  repo: string,
  token: string | null,
  filterPaths?: (paths: string[]) => string[],
): Promise<MemoryBlock[]> {
  const files = await listMemoryFiles(repo, token);
  const paths = filterPaths
    ? new Set(filterPaths(files.map((f) => f.path)))
    : null;
  const kept = paths ? files.filter((f) => paths.has(f.path)) : files;
  return Promise.all(
    kept.map(async (f) => ({
      path: f.path,
      content: await fetchFileContent(repo, f.path, token),
    })),
  );
}

// Lists .md files in an arbitrary repo directory (e.g. "sessions/inbox").
// Returns [] for a missing directory (404) — a brain that has never received an
// iOS share simply has no sessions/inbox folder.
export async function listDirMarkdownFiles(
  repo: string,
  token: string | null,
  dir: string,
): Promise<AvailableFile[]> {
  const hdrs: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) hdrs.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${dir}`, {
    headers: hdrs,
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return (data as GhContentsItem[])
    .filter((f) => f.type === "file" && f.name.endsWith(".md"))
    .map((f) => ({ name: f.name, path: f.path }));
}

// Lists voice-memo files across all date subdirectories of inbox/voice-memos.
// The recorder files memos under inbox/voice-memos/YYYY-MM-DD/, so this lists the
// date dirs first, then the .md files inside each. Returns [] when the brain has
// never received a voice memo (the directory simply doesn't exist).
export async function listVoiceMemoFiles(
  repo: string,
  token: string | null,
): Promise<AvailableFile[]> {
  const hdrs: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) hdrs.Authorization = `Bearer ${token}`;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/inbox/voice-memos`,
    { headers: hdrs, cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  const dateDirs = (data as GhContentsItem[]).filter((f) => f.type === "dir");

  const perDir = await Promise.all(
    dateDirs.map((d) => listDirMarkdownFiles(repo, token, d.path)),
  );
  return perDir.flat();
}

// Deletes a single file from the repo via the Contents API. Resolves the file's
// blob sha itself (the Contents DELETE requires it) so callers only pass a path.
export async function deleteRepoFile(params: {
  repo: string;
  token: string;
  path: string;
  commitMessage: string;
}): Promise<{ ok: true; sha: string } | { ok: false; error: string }> {
  const { repo, token, path, commitMessage } = params;
  const hdrs = ghWriteHeaders(token);

  const getRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encodeURI(path)}`,
    { headers: hdrs, cache: "no-store" },
  );
  if (getRes.status === 404) return { ok: false, error: "File not found." };
  if (!getRes.ok) return { ok: false, error: `Could not read file (${getRes.status}).` };
  const fileData = (await getRes.json()) as { sha?: string };
  if (!fileData.sha) return { ok: false, error: "File has no sha." };

  const delRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encodeURI(path)}`,
    {
      method: "DELETE",
      headers: hdrs,
      body: JSON.stringify({ message: commitMessage, sha: fileData.sha }),
      cache: "no-store",
    },
  );
  if (!delRes.ok) return { ok: false, error: `Failed to delete file (${delRes.status}).` };
  const delData = (await delRes.json()) as { commit?: { sha?: string } };
  return { ok: true, sha: delData.commit?.sha ?? fileData.sha };
}

// ── Recursive tree listing ─────────────────────────────────────────────────────

export type RepoTreeEntry = {
  path: string;
  type: "blob" | "tree";
  sha: string;
};

type GhTreeListResponse = {
  tree?: Array<{ path?: string; type?: string; sha?: string }>;
  truncated?: boolean;
};

/**
 * Lists every file in the brain repo via the recursive git-tree API (one request
 * instead of N directory walks). Returns [] on any failure. `truncated` is ignored
 * because brain repos are far below GitHub's 100k-entry / 7MB tree ceiling.
 */
export async function listRepoTree(
  repo: string,
  token: string | null,
): Promise<RepoTreeEntry[]> {
  const hdrs: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) hdrs.Authorization = `Bearer ${token}`;

  const repoRes = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: hdrs,
    cache: "no-store",
  });
  if (!repoRes.ok) return [];
  const repoData = (await repoRes.json()) as GhRepo;
  const branch = repoData.default_branch;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
    { headers: hdrs, cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as GhTreeListResponse;
  if (!Array.isArray(data.tree)) return [];
  return data.tree
    .filter(
      (e): e is { path: string; type: "blob" | "tree"; sha: string } =>
        typeof e.path === "string" &&
        (e.type === "blob" || e.type === "tree") &&
        typeof e.sha === "string",
    )
    .map((e) => ({ path: e.path, type: e.type, sha: e.sha }));
}

/**
 * Moves a file from one path to another in a single commit (the brain-repo
 * equivalent of `git mv`): the file content is preserved at the new path and the
 * old path is deleted in the same tree mutation. Returns the new commit SHA.
 */
export async function moveRepoFile(params: {
  repo: string;
  token: string;
  fromPath: string;
  toPath: string;
  commitMessage: string;
}): Promise<{ ok: true; sha: string } | { ok: false; error: string }> {
  const { repo, token, fromPath, toPath, commitMessage } = params;
  if (fromPath === toPath) return { ok: false, error: "Source and destination are identical." };
  const hdrs = ghWriteHeaders(token);

  const repoRes = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: hdrs,
    cache: "no-store",
  });
  if (!repoRes.ok) return { ok: false, error: `GitHub repo fetch failed (${repoRes.status}).` };
  const branch = ((await repoRes.json()) as GhRepo).default_branch;

  const refRes = await fetch(
    `https://api.github.com/repos/${repo}/git/refs/heads/${branch}`,
    { headers: hdrs, cache: "no-store" },
  );
  if (!refRes.ok) return { ok: false, error: `Could not read branch ref (${refRes.status}).` };
  const headSha = ((await refRes.json()) as GhRef).object.sha;

  const baseCommitRes = await fetch(
    `https://api.github.com/repos/${repo}/git/commits/${headSha}`,
    { headers: hdrs, cache: "no-store" },
  );
  if (!baseCommitRes.ok) return { ok: false, error: "Could not fetch base commit." };
  const baseTreeSha = ((await baseCommitRes.json()) as GhCommit).tree.sha;

  // Read the source content so we can recreate it at the new path. Reading via the
  // Contents API also confirms the source exists before we mutate the tree.
  const content = await fetchFileContent(repo, fromPath, token);
  if (!content) return { ok: false, error: `Source file not found or empty: ${fromPath}` };

  const blobRes = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({ content, encoding: "utf-8" }),
    cache: "no-store",
  });
  if (!blobRes.ok) return { ok: false, error: `Failed to create blob (${blobRes.status}).` };
  const blobSha = ((await blobRes.json()) as GhBlob).sha;

  const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [
        { path: toPath, mode: "100644", type: "blob", sha: blobSha },
        // sha:null removes the entry at the old path from the new tree.
        { path: fromPath, mode: "100644", type: "blob", sha: null },
      ],
    }),
    cache: "no-store",
  });
  if (!treeRes.ok) return { ok: false, error: `Failed to create git tree (${treeRes.status}).` };
  const newTreeSha = ((await treeRes.json()) as GhTree).sha;

  const now = new Date().toISOString();
  const newCommitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({
      message: commitMessage,
      tree: newTreeSha,
      parents: [headSha],
      author: { name: repo.split("/")[0], email: "noreply@github.com", date: now },
    }),
    cache: "no-store",
  });
  if (!newCommitRes.ok) return { ok: false, error: `Failed to create commit (${newCommitRes.status}).` };
  const newCommitSha = ((await newCommitRes.json()) as GhNewCommit).sha;

  const updateRes = await fetch(
    `https://api.github.com/repos/${repo}/git/refs/heads/${branch}`,
    {
      method: "PATCH",
      headers: hdrs,
      body: JSON.stringify({ sha: newCommitSha, force: false }),
      cache: "no-store",
    },
  );
  if (!updateRes.ok) return { ok: false, error: `Failed to update ref (${updateRes.status}).` };

  return { ok: true, sha: newCommitSha };
}

export function parseCitations(text: string): Citation[] {
  const re = /\[?(memory\/[^\]:\s]+\.md)(?::(\d+))?\]?/g;
  const seen = new Set<string>();
  const citations: Citation[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = `${m[1]}:${m[2] ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({ file: m[1], line: m[2] ?? "" });
    }
  }
  return citations;
}

export function formatMemoryBlocksForPrompt(blocks: MemoryBlock[]): string {
  return blocks
    .map(({ path, content }) => {
      const lines = content.split("\n");
      const numbered = lines.map((l, i) => `${i + 1}: ${l}`).join("\n");
      return `--- ${path} ---\n${numbered}`;
    })
    .join("\n\n");
}
