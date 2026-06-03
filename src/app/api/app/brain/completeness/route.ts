import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listMemoryFiles } from "@/lib/pa-brain";
import { fetchMemoryIndex } from "@/lib/pa-brain-index";
import type { MemoryEntryType } from "@/lib/pa-brain-index";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type CompletenessArea = {
  key: string;
  label: string;
  desc: string;
  filled: boolean;
};

export type CompletenessData = {
  filled: number;
  total: number;
  pct: number;
  areas: CompletenessArea[];
};

// Why this is signal-based, not exact-filename based:
// The previous implementation marked an area "filled" only if a specific
// template seed file existed (e.g. memory/user_about-the-business.md). Those
// names only exist in a brand-new install scaffolded by the onboarding wizard.
// An actively-used brain names files by content (project_pocket_agent_pivot_may12.md,
// feedback_no_time_estimates_strict.md, ...), so a fully-populated brain matched
// zero template paths and read as 0/7 forever.
//
// Each area is now satisfied by ANY memory file that matches its signals:
//   1. the canonical template path  (so wizard installs light up immediately), OR
//   2. a memory-entry `type` that belongs to the area, OR
//   3. a keyword found in the file's path / name / description.
// Signals are drawn from the live GitHub listing (always fresh) enriched with
// the memory index (descriptions + parsed types). The index is an enrichment,
// never the sole source — a connected-but-unindexed brain still scores from its
// live filenames, so a stale index can never silently zero the score.
type AreaMatcher = {
  key: string;
  label: string;
  desc: string;
  templateFile: string;
  types: MemoryEntryType[];
  keywords: string[];
};

const EXPECTED_AREAS: AreaMatcher[] = [
  {
    key: "business",
    label: "Your business",
    desc: "What you do and who runs it",
    templateFile: "memory/user_about-the-business.md",
    types: ["user"],
    keywords: [
      "business",
      "company",
      "studio",
      "brand",
      "what we do",
      "what you do",
      "consult",
      "revenue",
      "offer",
      "product",
      "saas",
    ],
  },
  {
    key: "customers",
    label: "Who you serve",
    desc: "Your ideal customer",
    templateFile: "memory/user_who-i-serve.md",
    types: [],
    keywords: [
      "customer",
      "client",
      "who i serve",
      "who you serve",
      "audience",
      "ideal customer",
      "avatar",
      "buyer",
      "prospect",
      "persona",
      "target market",
    ],
  },
  {
    key: "style",
    label: "How you work",
    desc: "Working style and voice",
    templateFile: "memory/feedback_how-i-work.md",
    types: ["feedback"],
    keywords: ["how i work", "working style", "voice", "preference", "tone", "convention"],
  },
  {
    key: "projects",
    label: "Current projects",
    desc: "Active work and priorities",
    templateFile: "memory/project_current-priorities.md",
    types: ["project"],
    keywords: ["project", "priorit", "current", "roadmap", "active", "lane", "initiative"],
  },
  {
    key: "decisions",
    label: "Key decisions",
    desc: "Decisions already locked in",
    templateFile: "memory/project_key-decisions.md",
    types: [],
    keywords: ["decision", "pivot", "anchor", "supersess", "rollback", "locked", "trade-off"],
  },
  {
    key: "tools",
    label: "Tools & stack",
    desc: "Apps and platforms you use",
    templateFile: "memory/reference_tools.md",
    types: ["reference"],
    keywords: [
      "tool",
      "stack",
      "vault",
      "1password",
      "platform",
      "integration",
      "supabase",
      "stripe",
      "github",
      "cloudflare",
    ],
  },
  {
    key: "avatar",
    label: "Customer Avatar",
    desc: "Who you sell to — makes every draft sharper",
    templateFile: "memory/customer-avatar.md",
    types: [],
    keywords: ["avatar"],
  },
];

// Infer a memory type from the filename prefix (user_/feedback_/project_/reference_),
// matching the indexer's own convention so unindexed files still classify.
function inferTypeFromName(name: string): MemoryEntryType {
  const base = name.toLowerCase();
  if (base.startsWith("user_")) return "user";
  if (base.startsWith("feedback_")) return "feedback";
  if (base.startsWith("project_")) return "project";
  if (base.startsWith("reference_")) return "reference";
  return "unknown";
}

type CorpusItem = { haystack: string; type: MemoryEntryType };

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

  // Live listing is the source of truth for what exists; the index enriches it
  // with descriptions + parsed types. A failed index fetch just degrades to
  // filename-only signals.
  const [files, indexRows] = await Promise.all([
    listMemoryFiles(brain_repo, github_token),
    fetchMemoryIndex(user.id),
  ]);

  const filePaths = new Set(files.map((f) => f.path));
  const indexByPath = new Map(indexRows.map((r) => [r.path, r]));

  const corpus: CorpusItem[] = files.map((f) => {
    const row = indexByPath.get(f.path);
    const parts = [f.path, f.name, row?.name ?? "", row?.description ?? ""];
    return {
      haystack: parts.join(" ").toLowerCase(),
      type: row?.type ?? inferTypeFromName(f.name),
    };
  });

  const areas: CompletenessArea[] = EXPECTED_AREAS.map((area) => {
    const filled =
      filePaths.has(area.templateFile) ||
      corpus.some(
        (item) =>
          (area.types.length > 0 && area.types.includes(item.type)) ||
          area.keywords.some((kw) => item.haystack.includes(kw)),
      );
    return { key: area.key, label: area.label, desc: area.desc, filled };
  });

  const filled = areas.filter((a) => a.filled).length;
  const total = areas.length;

  const response: CompletenessData = {
    filled,
    total,
    pct: Math.round((filled / total) * 100),
    areas,
  };

  return NextResponse.json(response);
}
