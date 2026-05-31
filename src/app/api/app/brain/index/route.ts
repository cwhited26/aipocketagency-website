import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { indexBrain, fetchMemoryIndex, type MemoryIndexRow, type RootFile } from "@/lib/pa-brain-index";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type BrainIndexResponse = {
  entries: MemoryIndexRow[];
  rootFiles: RootFile[];
  lastIndexed: string | null;
};

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
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "No account found" }, { status: 404 });
  }

  const paUser = paResult.data;
  const entries = await fetchMemoryIndex(user.id);

  const rootFiles: RootFile[] = Array.isArray(paUser.brain_root_index_json)
    ? (paUser.brain_root_index_json as RootFile[])
    : [];

  const response: BrainIndexResponse = {
    entries,
    rootFiles,
    lastIndexed: paUser.brain_indexed_at ?? null,
  };

  return NextResponse.json(response);
}

export async function POST(): Promise<NextResponse> {
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

  const result = await indexBrain({
    userId: user.id,
    repo: brain_repo,
    token: github_token,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: result.result });
}
