import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileBytes } from "@/lib/pa-brain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/app/brain/asset?path=assets/<file> — streams a stored binary asset (image/PDF) from the
// owner's brain repo, authenticated. The Ask box upload card points its thumbnail <img> here, so a
// private-repo screenshot renders inline without ever exposing the GitHub token to the browser.

const QuerySchema = z.object({ path: z.string().min(1).max(500) });

// Only assets/ — never memory/ or arbitrary repo paths.
function isAllowedAssetPath(path: string): boolean {
  return path.startsWith("assets/") && !path.includes("..");
}

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const parsed = QuerySchema.safeParse({ path: req.nextUrl.searchParams.get("path") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid path parameter" }, { status: 400 });
  }
  const { path } = parsed.data;
  if (!isAllowedAssetPath(path)) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data?.brain_repo) {
    return NextResponse.json({ error: "No brain connected" }, { status: 404 });
  }

  const { brain_repo, github_token } = paResult.data;
  const bytes = await fetchFileBytes(brain_repo, path, github_token);
  if (!bytes) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": contentTypeFor(path),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
