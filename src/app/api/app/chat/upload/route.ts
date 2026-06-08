import { createClient } from "@/lib/supabase/server";
import { chatAsHomeEnabled } from "@/lib/chat/feature-flag";
import { insertMessage, ChatDbError } from "@/lib/chat/db";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  absorbToMemory,
  isAllowedUploadType,
  MAX_UPLOAD_BYTES,
} from "@/lib/brain/absorb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wave A surfaced a dropped file as a metadata-only doc_preview card; the bytes never landed.
// It now runs the same canonical pipeline as /api/app/brain/upload (lib/brain/absorb.ts): the
// file is persisted to assets/<filename> (+ absorbed into memory when readable), then the card
// renders with an excerpt and an "Open file →" link into Documents where the asset now lives.

const TEXT_PREVIEW_RE = /^text\//;

function excerptFor(mimeType: string, fileName: string, buffer: Buffer): string | undefined {
  if (TEXT_PREVIEW_RE.test(mimeType) || /\.(md|txt|csv|json)$/i.test(fileName)) {
    const text = buffer.toString("utf-8").slice(0, 200).trim();
    return text || undefined;
  }
  return undefined;
}

// POST /api/app/chat/upload  (multipart form-data, field "file") → { card }
export async function POST(req: Request): Promise<NextResponse> {
  if (!chatAsHomeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart request" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!isAllowedUploadType(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload PDF, PNG, JPG, WebP, TXT, or Markdown files." },
      { status: 422 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1_048_576).toFixed(1)} MB). Maximum is 10 MB.` },
      { status: 422 },
    );
  }

  const { data: { session } } = await supabase.auth.getSession();
  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }
  const paUser = paResult.data;
  const githubToken = paUser.github_token ?? session?.provider_token ?? null;
  if (!paUser.brain_repo || !githubToken) {
    return NextResponse.json({ error: "No brain repo connected" }, { status: 400 });
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

  // Prefer Claude's absorption summary as the excerpt; fall back to a text preview.
  const excerpt = result.summary ?? excerptFor(file.type, file.name, buffer);

  try {
    const card = await insertMessage({
      userId: user.id,
      role: "inline_card",
      cardKind: "doc_preview",
      cardPayload: {
        fileName: file.name,
        mimeType: file.type || undefined,
        sizeBytes: file.size,
        excerpt: excerpt || undefined,
        // The asset now lives in the brain; Documents lists it under "Uploaded files".
        openHref: "/app/documents",
      },
      filterTags: ["docs"],
    });
    return NextResponse.json({ card, assetPath: result.assetPath, absorbed: result.absorbed });
  } catch (e) {
    const status = e instanceof ChatDbError ? e.status : 500;
    return NextResponse.json({ error: "Saved to brain but could not add the card" }, { status });
  }
}
