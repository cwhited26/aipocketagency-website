import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getProject, listProjectReferences, addProjectReference } from "@/lib/pa-projects";
import { canOcrType, runVisionOcr, buildOcrContextBlock } from "@/lib/vision/ocr";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CONTENT_CHARS = 100_000; // cap stored extracted text

// Text-like uploads we can decode directly (no vision needed). Anything else must be an image/PDF
// the vision OCR path can read; truly unsupported types are rejected with a clear message.
function isDecodableText(mimeType: string, fileName: string): boolean {
  if (mimeType.startsWith("text/")) return true;
  if (["application/json", "application/xml"].includes(mimeType)) return true;
  return /\.(md|markdown|txt|csv|tsv|json|xml|yml|yaml)$/i.test(fileName);
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listProjectReferences(params.id, user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ references: result.data });
}

// Paste-in reference (no file) — title + text typed straight into the References tab.
const pasteSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentText: z.string().min(1).max(MAX_CONTENT_CHARS),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProject(params.id, user.id);
  if (!project.ok) return NextResponse.json({ error: project.error }, { status: project.status });
  if (!project.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") ?? "";

  // ── Paste-in path (JSON) ──
  if (!contentType.includes("multipart/form-data")) {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = pasteSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });
    const result = await addProjectReference(params.id, user.id, {
      fileName: parsed.data.fileName.trim(),
      contentText: parsed.data.contentText.trim(),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ reference: result.data }, { status: 201 });
  }

  // ── File upload path (multipart) ──
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart request" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `${file.name} is too large (${(file.size / 1_048_576).toFixed(1)} MB). Maximum is 10 MB.` },
      { status: 422 },
    );
  }

  const fileName = file.name || "reference";
  const buffer = Buffer.from(await file.arrayBuffer());
  let contentText: string;

  if (isDecodableText(file.type, fileName)) {
    contentText = buffer.toString("utf-8").trim();
    if (!contentText) {
      return NextResponse.json({ error: `${fileName} is empty.` }, { status: 422 });
    }
  } else if (canOcrType(file.type)) {
    // Image/PDF → extract text with Claude vision so every conversation in the project can read it.
    const paResult = await fetchPaUser(user.id);
    const apiKey = paResult.ok ? paResult.data?.anthropic_api_key : null;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Add your Anthropic API key in Settings to upload image or PDF references." },
        { status: 402 },
      );
    }
    const ocr = await runVisionOcr({ apiKey, mimeType: file.type, buffer });
    if (!ocr.ok) {
      // Surface the real reason instead of silently storing an unreadable file.
      return NextResponse.json({ error: `Could not read ${fileName}: ${ocr.error}` }, { status: 422 });
    }
    contentText = buildOcrContextBlock(fileName, ocr);
  } else {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type || fileName}. Upload a text/markdown/CSV file, or an image/PDF.` },
      { status: 422 },
    );
  }

  if (contentText.length > MAX_CONTENT_CHARS) {
    contentText = `${contentText.slice(0, MAX_CONTENT_CHARS)}\n…[reference truncated]`;
  }

  const result = await addProjectReference(params.id, user.id, { fileName, contentText });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ reference: result.data }, { status: 201 });
}
