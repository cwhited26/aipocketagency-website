import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Types Claude can natively read
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

// ─── GitHub helpers ────────────────────────────────────────────────────────────

type GhRef = { object: { sha: string } };
type GhCommit = { tree: { sha: string } };
type GhBlob = { sha: string };
type GhTree = { sha: string };
type GhNewCommit = { sha: string };
type GhRepo = { default_branch: string };
type GhFileContent = { encoding: string; content: string };

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

type CommitFile = { content: string; encoding: "base64" | "utf-8" };

async function commitFiles(
  repo: string,
  token: string,
  branch: string,
  files: Map<string, CommitFile>,
  message: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
  return { ok: true };
}

// ─── Claude extraction ─────────────────────────────────────────────────────────

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

type ExtractionResult =
  | { ok: true; summary: string; memoryPath: string; memoryName: string; memoryType: string; memoryBody: string; memoryDescription: string }
  | { ok: false; error: string };

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

async function extractContent(
  apiKey: string,
  file: File,
  buffer: Buffer,
  base64: string,
): Promise<ExtractionResult> {
  let content: ContentBlock[];

  if (CLAUDE_DOC_TYPES.has(file.type)) {
    content = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
      { type: "text", text: ABSORPTION_PROMPT },
    ];
  } else if (CLAUDE_IMAGE_TYPES.has(file.type)) {
    content = [
      { type: "image", source: { type: "base64", media_type: file.type, data: base64 } },
      { type: "text", text: ABSORPTION_PROMPT },
    ];
  } else if (TEXT_TYPES.has(file.type)) {
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

  const memName = (parsed.memoryName ?? "uploaded-content")
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

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart request." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported file type. Upload PDF, PNG, JPG, WebP, TXT, or Markdown files.`,
      },
      { status: 422 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1_048_576).toFixed(1)} MB). Maximum is 10 MB.` },
      { status: 422 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Token: prefer DB-stored github_token; provider_token only lives right after OAuth
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "User record not found." }, { status: 404 });
  }
  const paUser = paResult.data;
  const githubToken = paUser.github_token ?? session?.provider_token ?? null;

  if (!paUser.brain_repo || !githubToken) {
    return NextResponse.json(
      { error: "No brain repo connected or no GitHub token available." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const branchResult = await getDefaultBranch(paUser.brain_repo, githubToken);
  if (!branchResult.ok) {
    return NextResponse.json({ error: branchResult.error }, { status: 503 });
  }
  const branch = branchResult.branch;

  // Safe filename for assets/ folder
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
  const assetPath = `assets/${safeName}`;

  const fileLabel = TYPE_LABELS[file.type] ?? file.type;
  const canAbsorb =
    CLAUDE_DOC_TYPES.has(file.type) ||
    CLAUDE_IMAGE_TYPES.has(file.type) ||
    TEXT_TYPES.has(file.type);

  // No Anthropic key → store file, tell user to add key
  if (!paUser.anthropic_api_key) {
    const files = new Map<string, CommitFile>([[assetPath, { content: base64, encoding: "base64" }]]);
    const commitResult = await commitFiles(
      paUser.brain_repo, githubToken, branch, files,
      `Pocket Agent — store ${safeName}`,
    );
    if (!commitResult.ok) {
      return NextResponse.json({ error: commitResult.error }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      stored: true,
      absorbed: false,
      assetPath,
      noKey: true,
      message: `${fileLabel} stored in your brain. Add your Anthropic API key in Settings to have the agent absorb it into memory.`,
    });
  }

  // Type can't be absorbed even with key (HEIC, DOCX)
  if (!canAbsorb) {
    const files = new Map<string, CommitFile>([[assetPath, { content: base64, encoding: "base64" }]]);
    const commitResult = await commitFiles(
      paUser.brain_repo, githubToken, branch, files,
      `Pocket Agent — store ${safeName}`,
    );
    if (!commitResult.ok) {
      return NextResponse.json({ error: commitResult.error }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      stored: true,
      absorbed: false,
      assetPath,
      message: `${fileLabel} stored in your brain repo. Convert to PDF or PNG for the agent to absorb it into memory.`,
    });
  }

  // Extract + absorb via Claude
  const extraction = await extractContent(paUser.anthropic_api_key, file, buffer, base64);

  if (!extraction.ok) {
    // Still store the asset even if extraction fails
    const files = new Map<string, CommitFile>([[assetPath, { content: base64, encoding: "base64" }]]);
    await commitFiles(paUser.brain_repo, githubToken, branch, files, `Pocket Agent — store ${safeName}`);
    return NextResponse.json(
      {
        ok: true,
        stored: true,
        absorbed: false,
        assetPath,
        message: `File stored but extraction failed: ${extraction.error}`,
      },
      { status: 207 },
    );
  }

  // Check if the target memory file already exists; if so, append instead of overwrite
  const existingMemory = await fetchExistingFile(paUser.brain_repo, githubToken, extraction.memoryPath);

  let finalMemoryContent: string;
  if (existingMemory) {
    // Append new content below a divider
    const uploadDate = new Date().toISOString().slice(0, 10);
    finalMemoryContent =
      existingMemory.trimEnd() +
      `\n\n---\n\n*Absorbed from upload (${uploadDate}):*\n\n${extraction.memoryBody.trim()}\n`;
  } else {
    // Create new file with frontmatter
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
    paUser.brain_repo, githubToken, branch, filesToCommit,
    `Pocket Agent — absorb ${safeName} into brain`,
  );

  if (!commitResult.ok) {
    return NextResponse.json({ error: commitResult.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    stored: true,
    absorbed: true,
    assetPath,
    memoryPath: extraction.memoryPath,
    summary: extraction.summary,
    message: extraction.summary,
  });
}
