import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ActivityItem = {
  id: string;
  label: string;
  sublabel: string | null;
  time: string;
  kind: "memory" | "upload" | "setup" | "draft" | "other";
};

export type ActivityResponse = {
  items: ActivityItem[];
};

// ─── GitHub helpers ────────────────────────────────────────────────────────────

type GhCommit = {
  sha: string;
  commit: {
    author: { date: string; name: string };
    message: string;
  };
};

function ghHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function fetchCommits(
  repo: string,
  token: string | null,
  perPage = 20,
): Promise<GhCommit[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/commits?per_page=${perPage}`,
    { headers: ghHeaders(token), cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data as GhCommit[];
}

// ─── Commit → agent-speak translation ─────────────────────────────────────────

const MEMORY_SLUG_LABELS: Record<string, string> = {
  "about-the-business": "your business",
  "who-i-serve": "your customers",
  "how-i-work": "your working style",
  "current-priorities": "your current projects",
  "key-decisions": "your key decisions",
  "tools": "your tools and stack",
};

function slugToTopic(slug: string): string {
  const label = MEMORY_SLUG_LABELS[slug];
  if (label) return label;
  return slug.replace(/-/g, " ");
}

function translateCommit(msg: string): { label: string; sublabel: string | null; kind: ActivityItem["kind"] } {
  const lower = msg.toLowerCase();

  // Pocket Agent absorb: "Pocket Agent — absorb {filename} into brain"
  const absorbMatch = msg.match(/Pocket Agent — absorb (.+?) into brain/i);
  if (absorbMatch) {
    const filename = absorbMatch[1].replace(/_/g, " ").replace(/\.[^.]+$/, "");
    return {
      label: `Absorbed "${filename}" into memory`,
      sublabel: "Document absorbed and learned",
      kind: "upload",
    };
  }

  // Pocket Agent store: "Pocket Agent — store {filename}"
  const storeMatch = msg.match(/Pocket Agent — store (.+)/i);
  if (storeMatch) {
    const filename = storeMatch[1].replace(/_/g, " ").replace(/\.[^.]+$/, "");
    return {
      label: `Stored file "${filename}"`,
      sublabel: "Saved to your brain — add an API key to absorb it",
      kind: "upload",
    };
  }

  // Initial brain setup: "Pocket Agent — initial brain setup"
  if (lower.includes("initial brain setup") || lower.includes("wizard brain setup")) {
    return {
      label: "Brain initialized",
      sublabel: "Your agent's knowledge base was created",
      kind: "setup",
    };
  }

  // Onboarding wizard commit: memory files written with specific names
  if (lower.includes("brain setup") || lower.includes("onboarding")) {
    return {
      label: "Brain calibrated",
      sublabel: "Your business context was written to memory",
      kind: "setup",
    };
  }

  // Memory file updates from manual edits: "memory/user_about-the-business.md"
  const memPathMatch = msg.match(/memory\/(?:user|feedback|project|reference)_([a-z0-9-]+)\.md/i);
  if (memPathMatch) {
    const topic = slugToTopic(memPathMatch[1]);
    return {
      label: `Learned about ${topic}`,
      sublabel: null,
      kind: "memory",
    };
  }

  // Draft events: message mentions "draft" or "quote" or "email"
  if (lower.includes("draft") || lower.includes("quote") || lower.includes("proposal")) {
    return {
      label: "Drafted a document for you",
      sublabel: null,
      kind: "draft",
    };
  }

  // Fallback: generic memory update if message mentions memory
  if (lower.includes("memory") || lower.includes("brain")) {
    return {
      label: "Updated your memory",
      sublabel: null,
      kind: "memory",
    };
  }

  // Fully generic fallback
  return {
    label: "Brain activity recorded",
    sublabel: msg.length > 80 ? msg.slice(0, 80) + "…" : msg,
    kind: "other",
  };
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
  const commits = await fetchCommits(brain_repo, github_token, 20);

  const items: ActivityItem[] = commits.map((c) => {
    const { label, sublabel, kind } = translateCommit(c.commit.message);
    return {
      id: c.sha,
      label,
      sublabel,
      time: c.commit.author.date,
      kind,
    };
  });

  const response: ActivityResponse = { items };
  return NextResponse.json(response);
}
