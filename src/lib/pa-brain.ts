type GhContentsItem = {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
};

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
