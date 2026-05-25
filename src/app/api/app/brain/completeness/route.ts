import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { listMemoryFiles } from "@/lib/pa-brain";
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

const EXPECTED_AREAS: Array<Omit<CompletenessArea, "filled"> & { file: string }> = [
  {
    key: "business",
    label: "Your business",
    file: "memory/user_about-the-business.md",
    desc: "What you do and who runs it",
  },
  {
    key: "customers",
    label: "Who you serve",
    file: "memory/user_who-i-serve.md",
    desc: "Your ideal customer",
  },
  {
    key: "style",
    label: "How you work",
    file: "memory/feedback_how-i-work.md",
    desc: "Working style and voice",
  },
  {
    key: "projects",
    label: "Current projects",
    file: "memory/project_current-priorities.md",
    desc: "Active work and priorities",
  },
  {
    key: "decisions",
    label: "Key decisions",
    file: "memory/project_key-decisions.md",
    desc: "Decisions already locked in",
  },
  {
    key: "tools",
    label: "Tools & stack",
    file: "memory/reference_tools.md",
    desc: "Apps and platforms you use",
  },
  {
    key: "avatar",
    label: "Customer Avatar",
    file: "memory/customer-avatar.md",
    desc: "Who you sell to — makes every draft sharper",
  },
];

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
  const files = await listMemoryFiles(brain_repo, github_token);
  const filePaths = new Set(files.map((f) => f.path));

  const areas: CompletenessArea[] = EXPECTED_AREAS.map((area) => ({
    key: area.key,
    label: area.label,
    desc: area.desc,
    filled: filePaths.has(area.file),
  }));

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
