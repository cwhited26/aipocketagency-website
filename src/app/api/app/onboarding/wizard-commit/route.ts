import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AnswersSchema = z.object({
  businessName: z.string().max(500).optional().default(""),
  whatYouDo: z.string().max(3000).optional().default(""),
  whoYouServe: z.string().max(3000).optional().default(""),
  howYouWork: z.string().max(3000).optional().default(""),
  currentProjects: z.string().max(3000).optional().default(""),
  keyDecisions: z.string().max(3000).optional().default(""),
  toolsYouUse: z.string().max(3000).optional().default(""),
});

type Answers = z.infer<typeof AnswersSchema>;

type GhContentsItem = { name: string; path: string; type: "file" | "dir" };
type GhRef = { object: { sha: string } };
type GhCommit = { tree: { sha: string } };
type GhBlob = { sha: string };
type GhTree = { sha: string };
type GhNewCommit = { sha: string };
type GhRepo = { default_branch: string };

// ─── Memory file builders ────────────────────────────────────────────────────

function frontmatter(name: string, description: string, type: string): string {
  return `---\nname: ${name}\ndescription: ${description}\nmetadata:\n  type: ${type}\n---\n`;
}

function buildMemoryFiles(a: Answers): Map<string, string> {
  const files = new Map<string, string>();

  if (a.businessName.trim() || a.whatYouDo.trim()) {
    const parts = [
      frontmatter("about-the-business", "What this business does and who runs it", "user"),
      "# About the Business\n",
    ];
    if (a.businessName.trim()) parts.push(`**Business:** ${a.businessName.trim()}\n`);
    if (a.whatYouDo.trim()) parts.push(`\n## What We Do\n\n${a.whatYouDo.trim()}\n`);
    files.set("memory/user_about-the-business.md", parts.join("\n"));
  }

  if (a.whoYouServe.trim()) {
    files.set(
      "memory/user_who-i-serve.md",
      [
        frontmatter("who-i-serve", "Ideal customer — who we serve and what they need", "user"),
        "# Who I Serve\n",
        a.whoYouServe.trim(),
        "",
      ].join("\n"),
    );
  }

  if (a.howYouWork.trim()) {
    files.set(
      "memory/feedback_how-i-work.md",
      [
        frontmatter(
          "how-i-work",
          "Working preferences, style, and how to collaborate",
          "feedback",
        ),
        "# How I Work\n",
        "**Why:** This shapes how Pocket Agent drafts, decides, and communicates.\n",
        a.howYouWork.trim(),
        "",
      ].join("\n"),
    );
  }

  if (a.currentProjects.trim()) {
    files.set(
      "memory/project_current-priorities.md",
      [
        frontmatter(
          "current-priorities",
          "Active projects and what to focus on right now",
          "project",
        ),
        "# Current Projects and Priorities\n",
        "**Why:** So Pocket Agent knows what's live and what's next without asking.\n",
        "**How to apply:** Reference these when answering about focus or priorities.\n",
        a.currentProjects.trim(),
        "",
      ].join("\n"),
    );
  }

  if (a.keyDecisions.trim()) {
    files.set(
      "memory/project_key-decisions.md",
      [
        frontmatter(
          "key-decisions",
          "Decisions already made — don't re-decide these",
          "project",
        ),
        "# Key Decisions\n",
        "**Why:** These are locked. Don't revisit without a strong reason.\n",
        a.keyDecisions.trim(),
        "",
      ].join("\n"),
    );
  }

  if (a.toolsYouUse.trim()) {
    files.set(
      "memory/reference_tools.md",
      [
        frontmatter("tools", "Apps, platforms, and tools used daily", "reference"),
        "# Tools I Use\n",
        a.toolsYouUse.trim(),
        "",
      ].join("\n"),
    );
  }

  return files;
}

function buildMemoryIndex(files: Map<string, string>): string {
  const labels: Record<string, string> = {
    "memory/user_about-the-business.md":
      "[About the Business](memory/user_about-the-business.md) — What this business does and who runs it",
    "memory/user_who-i-serve.md":
      "[Who I Serve](memory/user_who-i-serve.md) — Ideal customer description",
    "memory/feedback_how-i-work.md":
      "[How I Work](memory/feedback_how-i-work.md) — Working preferences and style",
    "memory/project_current-priorities.md":
      "[Current Priorities](memory/project_current-priorities.md) — Active projects and what to focus on",
    "memory/project_key-decisions.md":
      "[Key Decisions](memory/project_key-decisions.md) — Decisions already made",
    "memory/reference_tools.md":
      "[Tools](memory/reference_tools.md) — Apps and platforms used daily",
  };

  const lines = ["# Memory Index", ""];
  for (const path of files.keys()) {
    const label = labels[path];
    if (label) lines.push(`- ${label}`);
  }
  lines.push("");
  return lines.join("\n");
}

// ─── GitHub Git Data API helpers ─────────────────────────────────────────────

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "pocket-agent/1.0",
    "Content-Type": "application/json",
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function getDefaultBranch(
  repo: string,
  token: string,
): Promise<{ ok: true; branch: string } | { ok: false; error: string }> {
  // Retry up to 4 times (total ~12s wait) to handle template propagation delay
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(3000);
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: ghHeaders(token),
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as GhRepo;
      return { ok: true, branch: data.default_branch };
    }
    if (res.status !== 404) {
      return { ok: false, error: `GitHub returned ${res.status} fetching repo info.` };
    }
    // 404 → repo not ready yet, retry
  }
  return {
    ok: false,
    error: "Brain repo isn't ready yet. Wait a few seconds and try again.",
  };
}

async function listMemoryDir(
  repo: string,
  token: string,
): Promise<string[]> {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/memory`, {
    headers: ghHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const items = (await res.json()) as GhContentsItem[];
  return items
    .filter((f) => f.type === "file" && f.name.endsWith(".example.md"))
    .map((f) => f.path);
}

async function createBlob(
  repo: string,
  token: string,
  content: string,
): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({ content, encoding: "utf-8" }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as GhBlob;
  return data.sha;
}

async function commitFiles(
  repo: string,
  token: string,
  branch: string,
  newFiles: Map<string, string>,
  exampleFilesToDelete: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  // 1. Get HEAD commit SHA
  const refRes = await fetch(
    `https://api.github.com/repos/${repo}/git/refs/heads/${branch}`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (!refRes.ok) {
    return { ok: false, error: `Could not read ${branch} branch (${refRes.status}).` };
  }
  const refData = (await refRes.json()) as GhRef;
  const headSha = refData.object.sha;

  // 2. Get base tree SHA
  const commitRes = await fetch(
    `https://api.github.com/repos/${repo}/git/commits/${headSha}`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (!commitRes.ok) {
    return { ok: false, error: "Could not fetch base commit." };
  }
  const commitData = (await commitRes.json()) as GhCommit;
  const baseTreeSha = commitData.tree.sha;

  // 3. Create blobs for new/updated files
  type TreeItem = {
    path: string;
    mode: "100644";
    type: "blob";
    sha: string | null;
  };
  const treeItems: TreeItem[] = [];

  for (const [path, content] of newFiles) {
    const blobSha = await createBlob(repo, token, content);
    if (!blobSha) {
      return { ok: false, error: `Failed to create blob for ${path}.` };
    }
    treeItems.push({ path, mode: "100644", type: "blob", sha: blobSha });
  }

  // 4. Mark example files for deletion (sha: null removes them from the tree)
  for (const path of exampleFilesToDelete) {
    treeItems.push({ path, mode: "100644", type: "blob", sha: null });
  }

  if (treeItems.length === 0) {
    return { ok: true }; // nothing to commit
  }

  // 5. Create new tree
  const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
    method: "POST",
    headers: ghHeaders(token),
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    cache: "no-store",
  });
  if (!treeRes.ok) {
    return { ok: false, error: `Failed to create git tree (${treeRes.status}).` };
  }
  const treeData = (await treeRes.json()) as GhTree;

  // 6. Create commit
  const now = new Date().toISOString();
  const newCommitRes = await fetch(
    `https://api.github.com/repos/${repo}/git/commits`,
    {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify({
        message: "Pocket Agent — initial brain setup",
        tree: treeData.sha,
        parents: [headSha],
        author: {
          name: repo.split("/")[0],
          email: "noreply@github.com",
          date: now,
        },
      }),
      cache: "no-store",
    },
  );
  if (!newCommitRes.ok) {
    return { ok: false, error: `Failed to create commit (${newCommitRes.status}).` };
  }
  const newCommitData = (await newCommitRes.json()) as GhNewCommit;

  // 7. Update HEAD ref
  const updateRefRes = await fetch(
    `https://api.github.com/repos/${repo}/git/refs/heads/${branch}`,
    {
      method: "PATCH",
      headers: ghHeaders(token),
      body: JSON.stringify({ sha: newCommitData.sha, force: false }),
      cache: "no-store",
    },
  );
  if (!updateRefRes.ok) {
    return { ok: false, error: `Failed to update branch ref (${updateRefRes.status}).` };
  }

  return { ok: true };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AnswersSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }
  const answers = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }

  const { brain_repo, github_token } = paResult.data;
  if (!brain_repo || !github_token) {
    return NextResponse.json(
      { error: "No brain repo connected or no GitHub token available." },
      { status: 400 },
    );
  }

  // Get default branch (with retry for template propagation)
  const branchResult = await getDefaultBranch(brain_repo, github_token);
  if (!branchResult.ok) {
    return NextResponse.json({ error: branchResult.error }, { status: 503 });
  }

  // Find example files to delete
  const exampleFiles = await listMemoryDir(brain_repo, github_token);

  // Build memory file contents from answers
  const newFiles = buildMemoryFiles(answers);

  // If there are answers, also update MEMORY.md
  if (newFiles.size > 0) {
    newFiles.set("MEMORY.md", buildMemoryIndex(newFiles));
  }

  // Commit if there's anything to do
  if (newFiles.size === 0 && exampleFiles.length === 0) {
    return NextResponse.json({ ok: true, committed: false });
  }

  const commitResult = await commitFiles(
    brain_repo,
    github_token,
    branchResult.branch,
    newFiles,
    exampleFiles,
  );
  if (!commitResult.ok) {
    return NextResponse.json({ error: commitResult.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, committed: true });
}
