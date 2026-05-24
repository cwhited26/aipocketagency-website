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

export async function buildMemoryBlocks(
  repo: string,
  token: string | null,
): Promise<MemoryBlock[]> {
  const files = await listMemoryFiles(repo, token);
  return Promise.all(
    files.map(async (f) => ({
      path: f.path,
      content: await fetchFileContent(repo, f.path, token),
    })),
  );
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
