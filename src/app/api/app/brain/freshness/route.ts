import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FreshnessStatus = "fresh" | "warn" | "stale" | "empty";

export type FreshnessArea = {
  key: string;
  label: string;
  desc: string;
  prompt: string;
  filled: boolean;
  lastModified: string | null;
  daysSince: number | null;
  status: FreshnessStatus;
};

export type FreshnessResponse = {
  areas: FreshnessArea[];
  filled: number;
  total: number;
  pct: number;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const WARN_DAYS = 14;
const STALE_DAYS = 30;

const BRAIN_AREAS: Array<{
  key: string;
  label: string;
  desc: string;
  prompt: string;
  file: string;
}> = [
  {
    key: "business",
    label: "Your business",
    desc: "What you do and who runs it",
    prompt: "What your business does, what you offer, your rates, your story",
    file: "memory/user_about-the-business.md",
  },
  {
    key: "customers",
    label: "Who you serve",
    desc: "Your ideal customer",
    prompt: "Who your ideal customers are — pain points, demographics, use cases",
    file: "memory/user_who-i-serve.md",
  },
  {
    key: "style",
    label: "Your voice",
    desc: "How you communicate and work",
    prompt: "Your communication style, tone, and how you prefer to work",
    file: "memory/feedback_how-i-work.md",
  },
  {
    key: "projects",
    label: "Active projects",
    desc: "What's on your plate right now",
    prompt: "Your current active projects and what you're working on",
    file: "memory/project_current-priorities.md",
  },
  {
    key: "decisions",
    label: "Key decisions",
    desc: "Choices already locked in",
    prompt: "Decisions you've already made so the agent doesn't re-ask",
    file: "memory/project_key-decisions.md",
  },
  {
    key: "tools",
    label: "Tools & systems",
    desc: "Apps and platforms you use",
    prompt: "What apps, tools, and systems you use day-to-day",
    file: "memory/reference_tools.md",
  },
  {
    key: "avatar",
    label: "Customer Avatar",
    desc: "Who you sell to — makes every draft sharper",
    prompt: "Who buys from you, what they want, what they're afraid of, where they spend time",
    file: "memory/customer-avatar.md",
  },
];

// ─── GitHub helpers ────────────────────────────────────────────────────────────

type GhContentsItem = {
  name: string;
  path: string;
  type: "file" | "dir";
};

type GhCommit = {
  sha: string;
  commit: { author: { date: string } };
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

async function listMemoryDir(
  repo: string,
  token: string | null,
): Promise<Set<string>> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/memory`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (!res.ok) return new Set();
  const items = (await res.json()) as GhContentsItem[];
  if (!Array.isArray(items)) return new Set();
  return new Set(items.filter((i) => i.type === "file").map((i) => i.path));
}

async function fetchCommitDates(
  repo: string,
  token: string | null,
): Promise<Map<string, string>> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/commits?per_page=50`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (!res.ok) return new Map();
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return new Map();
  const commits = data as GhCommit[];

  const map = new Map<string, string>();
  for (const c of commits) {
    if (!c.files) continue;
    const date = c.commit.author.date;
    for (const f of c.files) {
      if (!map.has(f.filename)) map.set(f.filename, date);
    }
  }
  return map;
}

// ─── Staleness ─────────────────────────────────────────────────────────────────

function daysSinceIso(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function toStatus(filled: boolean, days: number | null): FreshnessStatus {
  if (!filled) return "empty";
  if (days === null) return "fresh"; // file exists, no commit date found — treat as fresh
  if (days <= WARN_DAYS) return "fresh";
  if (days <= STALE_DAYS) return "warn";
  return "stale";
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
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

  const [existingPaths, commitDates] = await Promise.all([
    listMemoryDir(brain_repo, github_token),
    fetchCommitDates(brain_repo, github_token),
  ]);

  const areas: FreshnessArea[] = BRAIN_AREAS.map((area) => {
    const filled = existingPaths.has(area.file);
    const lastModified = commitDates.get(area.file) ?? null;
    const days = daysSinceIso(lastModified);
    return {
      key: area.key,
      label: area.label,
      desc: area.desc,
      prompt: area.prompt,
      filled,
      lastModified,
      daysSince: days,
      status: toStatus(filled, days),
    };
  });

  const filled = areas.filter((a) => a.filled).length;
  const total = areas.length;

  const response: FreshnessResponse = {
    areas,
    filled,
    total,
    pct: Math.round((filled / total) * 100),
  };
  return NextResponse.json(response);
}
