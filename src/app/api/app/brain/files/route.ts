import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FileArea = "memory" | "assets" | "root";

export type BrainFile = {
  path: string;
  name: string;
  friendlyName: string;
  area: FileArea;
  kind: "markdown" | "image" | "pdf" | "binary" | "text";
  lastModified: string | null;
};

export type FilesResponse = {
  files: BrainFile[];
};

// ─── GitHub helpers ────────────────────────────────────────────────────────────

type GhContentsItem = {
  name: string;
  path: string;
  type: "file" | "dir";
};

type GhCommitItem = {
  sha: string;
  commit: {
    author: { date: string };
    message: string;
  };
  files?: Array<{ filename: string }>;
};

function ghHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function listDir(
  repo: string,
  token: string | null,
  dir: string,
): Promise<GhContentsItem[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${dir}`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as GhContentsItem[];
  return Array.isArray(data) ? data.filter((item) => item.type === "file") : [];
}

async function fetchRecentCommits(
  repo: string,
  token: string | null,
  perPage = 50,
): Promise<GhCommitItem[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/commits?per_page=${perPage}`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data as GhCommitItem[];
}

// ─── Label helpers ─────────────────────────────────────────────────────────────

const MEMORY_PREFIX_MAP: Record<string, string> = {
  "user_about-the-business": "About your business",
  "user_who-i-serve": "Who you serve",
  "feedback_how-i-work": "How you work",
  "project_current-priorities": "Current projects",
  "project_key-decisions": "Key decisions",
  "reference_tools": "Tools & stack",
  "MEMORY": "Memory index",
};

function friendlyMemoryName(filename: string): string {
  const base = filename.replace(/\.md$/i, "");
  if (base in MEMORY_PREFIX_MAP) return MEMORY_PREFIX_MAP[base];

  // Pattern: {type}_{slug} → humanise the slug
  const underIdx = base.indexOf("_");
  if (underIdx === -1) return toTitle(base);
  const slug = base.slice(underIdx + 1);
  return toTitle(slug.replace(/-/g, " "));
}

function toTitle(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function kindForName(name: string): BrainFile["kind"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return "markdown";
  if (lower.endsWith(".txt")) return "text";
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg|heic|heif)$/i.test(lower)) return "image";
  return "binary";
}

// ─── Route handler ─────────────────────────────────────────────────────────────

const _querySchema = z.object({});

export async function GET(): Promise<NextResponse> {
  void _querySchema; // satisfy "unused" lint

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

  // Fetch memory/ and assets/ in parallel with recent commits for last-modified dates
  const [memoryItems, assetItems, commits] = await Promise.all([
    listDir(brain_repo, github_token, "memory"),
    listDir(brain_repo, github_token, "assets"),
    fetchRecentCommits(brain_repo, github_token, 50),
  ]);

  // Build last-modified map: first commit mentioning each path wins (most recent)
  // GitHub /commits endpoint returns in reverse-chron order
  const lastModifiedMap = new Map<string, string>();
  for (const commit of commits) {
    const date = commit.commit.author.date;
    const msg = commit.commit.message.toLowerCase();
    // When individual file info isn't present, use message heuristics
    if (!commit.files) {
      // We can still tag paths mentioned in the message
      if (msg.includes("absorb") || msg.includes("store") || msg.includes("upload")) {
        // Skip — no specific path to key on
      }
      continue;
    }
    for (const f of commit.files) {
      if (!lastModifiedMap.has(f.filename)) {
        lastModifiedMap.set(f.filename, date);
      }
    }
  }

  // Fallback: use the date of the most recent commit touching memory/ in bulk
  // This is the commit date as a coarse "when was the brain last updated"
  const brainLastUpdated = commits[0]?.commit.author.date ?? null;

  const files: BrainFile[] = [];

  for (const item of memoryItems) {
    files.push({
      path: item.path,
      name: item.name,
      friendlyName: friendlyMemoryName(item.name),
      area: "memory",
      kind: kindForName(item.name),
      lastModified: lastModifiedMap.get(item.path) ?? brainLastUpdated,
    });
  }

  for (const item of assetItems) {
    files.push({
      path: item.path,
      name: item.name,
      friendlyName: item.name.replace(/_/g, " "),
      area: "assets",
      kind: kindForName(item.name),
      lastModified: lastModifiedMap.get(item.path) ?? null,
    });
  }

  // Sort memory files to known order first, then alpha
  files.sort((a, b) => {
    if (a.area !== b.area) return a.area === "memory" ? -1 : 1;
    return a.friendlyName.localeCompare(b.friendlyName);
  });

  const response: FilesResponse = { files };
  return NextResponse.json(response);
}
