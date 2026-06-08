import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  absorbToMemory,
  isAllowedUploadType,
  MAX_UPLOAD_BYTES,
} from "@/lib/brain/absorb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/app/brain/upload — the canonical capture pipeline (see lib/brain/absorb.ts).
// Stores the file in assets/ and, with an Anthropic key + a readable type, absorbs it into
// memory/. Shared verbatim with the chat share-card upload and the iOS share-extension triage.
export async function POST(req: Request): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart request." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (!isAllowedUploadType(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type. Upload PDF, PNG, JPG, WebP, TXT, or Markdown files.` },
      { status: 422 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1_048_576).toFixed(1)} MB). Maximum is 10 MB.` },
      { status: 422 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Token: prefer DB-stored github_token; provider_token only lives right after OAuth.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "User record not found." }, { status: 404 });
  }
  const paUser = paResult.data;
  const githubToken = paUser.github_token ?? session?.provider_token ?? null;

  if (!paUser.brain_repo || !githubToken) {
    return NextResponse.json(
      { error: "No brain repo connected or no GitHub token available." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await absorbToMemory({
    repo: paUser.brain_repo,
    token: githubToken,
    anthropicApiKey: paUser.anthropic_api_key,
    fileName: file.name,
    mimeType: file.type,
    buffer,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Extraction-failed-but-stored stays a 207 (Multi-Status) as before; everything else 200.
  const status = result.partial ? 207 : 200;
  return NextResponse.json(
    {
      ok: true,
      stored: result.stored,
      absorbed: result.absorbed,
      assetPath: result.assetPath,
      ...(result.memoryPath ? { memoryPath: result.memoryPath } : {}),
      ...(result.summary ? { summary: result.summary } : {}),
      ...(result.noKey ? { noKey: true } : {}),
      message: result.message,
    },
    { status },
  );
}
