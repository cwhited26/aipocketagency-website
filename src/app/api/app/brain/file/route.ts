import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent } from "@/lib/pa-brain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type FileContentResponse = {
  path: string;
  content: string;
  kind: "markdown" | "text" | "image" | "pdf" | "binary";
};

const QuerySchema = z.object({
  path: z.string().min(1).max(500),
});

function kindForPath(path: string): FileContentResponse["kind"] {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return "markdown";
  if (lower.endsWith(".txt")) return "text";
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg|heic|heif)$/i.test(lower)) return "image";
  return "binary";
}

// Only allow paths within memory/ and assets/ to prevent arbitrary file reads
function isAllowedPath(path: string): boolean {
  return path.startsWith("memory/") || path.startsWith("assets/");
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const parsed = QuerySchema.safeParse({
    path: req.nextUrl.searchParams.get("path") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid path parameter" }, { status: 400 });
  }
  const { path } = parsed.data;

  if (!isAllowedPath(path)) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

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
  const kind = kindForPath(path);

  if (kind === "binary" || kind === "pdf" || kind === "image") {
    return NextResponse.json({ error: "File type cannot be previewed inline" }, { status: 415 });
  }

  const content = await fetchFileContent(brain_repo, path, github_token);
  if (content === "") {
    return NextResponse.json({ error: "File not found or empty" }, { status: 404 });
  }

  const response: FileContentResponse = { path, content, kind };
  return NextResponse.json(response);
}
