import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { buildBrainGraph, type BrainGraph } from "@/lib/brain/graph";
import { buildBrainFolderGraph, type FolderGraph } from "@/lib/brain/graph-folders";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type GraphResponse = BrainGraph;
export type FolderGraphResponse = FolderGraph;

// Reads the signed-in owner's brain repo and returns the Brain Map graph.
// Mirrors /api/app/brain/files: auth → resolve the brain repo + GitHub token →
// hand the read to the chosen builder (both talk GitHub REST directly).
//
// ?mode=galaxy (default) → the semantic-category graph (graph.ts).
// ?mode=folders          → the folder + key-file structural graph (graph-folders.ts).
export async function GET(req: NextRequest): Promise<NextResponse> {
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
  const mode = req.nextUrl.searchParams.get("mode") === "folders" ? "folders" : "galaxy";

  if (mode === "folders") {
    const graph = await buildBrainFolderGraph(brain_repo, github_token);
    return NextResponse.json(graph);
  }

  const meta = user.user_metadata ?? {};
  const ownerName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.user_name === "string" && meta.user_name) ||
    null;

  const graph = await buildBrainGraph(brain_repo, github_token, { ownerName });
  return NextResponse.json(graph);
}
