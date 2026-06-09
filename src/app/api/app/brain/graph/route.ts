import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { buildBrainGraph, type BrainGraph } from "@/lib/brain/graph";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type GraphResponse = BrainGraph;

// Reads the signed-in owner's brain repo and returns the Brain Map graph.
// Mirrors /api/app/brain/files: auth → resolve the brain repo + GitHub token →
// hand the read to the graph builder (which talks GitHub REST directly).
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
  const meta = user.user_metadata ?? {};
  const ownerName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.user_name === "string" && meta.user_name) ||
    null;

  const graph = await buildBrainGraph(brain_repo, github_token, { ownerName });
  return NextResponse.json(graph);
}
