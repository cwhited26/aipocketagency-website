import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listRepoTree, fetchFileContent, moveRepoFile } from "@/lib/pa-brain";
import {
  MEMORY_TIER_FOLDER,
  MEMORY_TIERS,
  tierFromPath,
  type MemoryTier,
} from "@/lib/brain/memory-tier";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type MemoryListEntry = {
  path: string;
  name: string;
  // null = a legacy flat memory/*.md file that predates the tier split ("untiered").
  tier: MemoryTier | null;
};

export type MemoryListResponse = { entries: MemoryListEntry[] };
export type MemoryFileResponse = { path: string; content: string };

// Lists every markdown file under memory/ and tags each with its tier (or null).
async function listMemoryEntries(
  repo: string,
  token: string | null,
): Promise<MemoryListEntry[]> {
  const tree = await listRepoTree(repo, token);
  return tree
    .filter(
      (e) =>
        e.type === "blob" &&
        e.path.startsWith("memory/") &&
        e.path.toLowerCase().endsWith(".md") &&
        e.path.toUpperCase() !== "MEMORY.MD",
    )
    .map((e) => ({
      path: e.path,
      name: e.path.split("/").pop() ?? e.path,
      tier: tierFromPath(e.path),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// GET            → list all memory entries with tiers
// GET ?path=...  → read one memory file's content
export async function GET(request: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data?.brain_repo) {
    return NextResponse.json({ error: "No brain connected" }, { status: 404 });
  }
  const { brain_repo, github_token } = paResult.data;

  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  if (path) {
    if (!/^memory\//.test(path) || path.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const content = await fetchFileContent(brain_repo, path, github_token);
    const response: MemoryFileResponse = { path, content };
    return NextResponse.json(response);
  }

  const entries = await listMemoryEntries(brain_repo, github_token);
  const response: MemoryListResponse = { entries };
  return NextResponse.json(response);
}

// POST → move a memory file into a different tier (git mv).
const MoveSchema = z.object({
  fromPath: z.string().regex(/^memory\/(?:[a-z][a-z0-9-]*\/)?[^/]+\.md$/, "Invalid memory path"),
  toTier: z.enum(["work", "knowledge", "learning"]),
});

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data?.brain_repo) {
    return NextResponse.json({ error: "No brain connected" }, { status: 404 });
  }
  if (!paResult.data.github_token) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 403 });
  }
  const { brain_repo, github_token } = paResult.data;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = MoveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { fromPath, toTier } = parsed.data;
  const fileName = fromPath.split("/").pop() as string;
  const toPath = `${MEMORY_TIER_FOLDER[toTier as MemoryTier]}/${fileName}`;

  if (toPath === fromPath) {
    return NextResponse.json({ error: "File is already in that tier." }, { status: 409 });
  }

  const result = await moveRepoFile({
    repo: brain_repo,
    token: github_token,
    fromPath,
    toPath,
    commitMessage: `brain: move ${fileName} to ${toTier} tier`,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Surface the available tiers so the client can render the move menu without
  // re-deriving them.
  return NextResponse.json({ ok: true, sha: result.sha, toPath, tiers: MEMORY_TIERS });
}
