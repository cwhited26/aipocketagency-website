import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnedPersona, resolveOwner } from "@/lib/personas/owner";
import { PersonaDbError } from "@/lib/personas/db";
import {
  listKnowledgeFiles,
  removeKnowledgeFile,
  safeKnowledgeFilename,
  writeKnowledgeFile,
} from "@/lib/personas/knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const TEXT_TYPES = new Set(["text/plain", "text/markdown"]);
const CLAUDE_DOC_TYPES = new Set(["application/pdf"]);
const CLAUDE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type Params = { params: { id: string } };

// GET — list the persona's knowledge files (name, path, size).
export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });
    const files = await listKnowledgeFiles(owner.ctx.brainRepo, owner.ctx.githubToken, owned.persona.slug);
    return NextResponse.json({ files });
  } catch (e) {
    return fail(e);
  }
}

const EXTRACT_PROMPT = `Extract ALL meaningful content from this document as clean, well-structured Markdown. Preserve headings, lists, tables, names, numbers, policies, and procedures exactly. Do not summarize or omit detail — this becomes an AI agent's reference knowledge. Output ONLY the Markdown, no preamble.`;

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

async function extractToMarkdown(
  apiKey: string,
  file: File,
  buffer: Buffer,
): Promise<{ ok: true; markdown: string } | { ok: false; error: string }> {
  if (TEXT_TYPES.has(file.type)) {
    return { ok: true, markdown: buffer.toString("utf-8") };
  }

  let content: ContentBlock[];
  const base64 = buffer.toString("base64");
  if (CLAUDE_DOC_TYPES.has(file.type)) {
    content = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
      { type: "text", text: EXTRACT_PROMPT },
    ];
  } else if (CLAUDE_IMAGE_TYPES.has(file.type)) {
    content = [
      { type: "image", source: { type: "base64", media_type: file.type, data: base64 } },
      { type: "text", text: EXTRACT_PROMPT },
    ];
  } else if (file.type === DOCX_TYPE) {
    // Claude reads .docx as a PDF-class document block.
    content = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
      { type: "text", text: EXTRACT_PROMPT },
    ];
  } else {
    return { ok: false, error: `Unsupported file type: ${file.type || "unknown"}` };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.PA_PERSONAS_DEFAULT_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content }],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `Extraction failed (${res.status}): ${t.slice(0, 160)}` };
  }
  type Resp = { content: Array<{ type: string; text?: string }> };
  const data = (await res.json()) as Resp;
  const md = data.content.find((c) => c.type === "text")?.text ?? "";
  if (!md.trim()) return { ok: false, error: "Could not extract any text from the file." };
  return { ok: true, markdown: md };
}

const urlSchema = z.object({ url: z.string().url() });

async function ingestUrl(
  url: string,
): Promise<{ ok: true; filename: string; markdown: string } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": "pocket-agent/1.0" }, cache: "no-store" });
  } catch (e) {
    return { ok: false, error: `Could not fetch URL: ${e instanceof Error ? e.message : "error"}` };
  }
  if (!res.ok) return { ok: false, error: `URL returned ${res.status}` };
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100_000);
  if (!text) return { ok: false, error: "No readable text found at that URL." };
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/[^a-z0-9]+/gi, "-");
    } catch {
      return "source";
    }
  })();
  return {
    ok: true,
    filename: `url-${host}-${Date.now()}.md`,
    markdown: `# Source: ${url}\n\n${text}\n`,
  };
}

// POST — upload a knowledge doc (multipart file) or ingest a URL (JSON {url}).
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  if (!owner.ctx.githubToken) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 403 });
  }

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });
    const { persona } = owned;

    const contentType = req.headers.get("content-type") ?? "";

    // URL ingest path.
    if (contentType.includes("application/json")) {
      const raw = await req.json().catch(() => null);
      const parsed = urlSchema.safeParse(raw);
      if (!parsed.success) return NextResponse.json({ error: "Invalid URL" }, { status: 422 });
      const ingested = await ingestUrl(parsed.data.url);
      if (!ingested.ok) return NextResponse.json({ error: ingested.error }, { status: 422 });
      const written = await writeKnowledgeFile({
        repo: owner.ctx.brainRepo,
        token: owner.ctx.githubToken,
        slug: persona.slug,
        filename: ingested.filename,
        content: ingested.markdown,
      });
      if (!written.ok) return NextResponse.json({ error: written.error }, { status: 502 });
      return NextResponse.json({ ok: true, path: written.path }, { status: 201 });
    }

    // File upload path.
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 422 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });
    }

    const needsExtraction = !TEXT_TYPES.has(file.type);
    if (needsExtraction && !owner.ctx.anthropicKey) {
      return NextResponse.json(
        { error: "Add your Anthropic API key in Settings to upload PDFs, Word docs, or images." },
        { status: 402 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractToMarkdown(owner.ctx.anthropicKey ?? "", file, buffer);
    if (!extracted.ok) return NextResponse.json({ error: extracted.error }, { status: 422 });

    const baseName = safeKnowledgeFilename(file.name);
    const filename = TEXT_TYPES.has(file.type)
      ? baseName
      : `${baseName.replace(/\.[^.]+$/, "")}.md`;

    const written = await writeKnowledgeFile({
      repo: owner.ctx.brainRepo,
      token: owner.ctx.githubToken,
      slug: persona.slug,
      filename,
      content: extracted.markdown,
    });
    if (!written.ok) return NextResponse.json({ error: written.error }, { status: 502 });
    return NextResponse.json({ ok: true, path: written.path }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

const deleteSchema = z.object({ filename: z.string().min(1).max(200) });

export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  const owner = await resolveOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status });
  if (!owner.ctx.githubToken) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 403 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  try {
    const owned = await requireOwnedPersona(params.id, owner.ctx.userId);
    if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });
    const removed = await removeKnowledgeFile({
      repo: owner.ctx.brainRepo,
      token: owner.ctx.githubToken,
      slug: owned.persona.slug,
      filename: safeKnowledgeFilename(parsed.data.filename),
    });
    if (!removed.ok) return NextResponse.json({ error: removed.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown): NextResponse {
  const status = e instanceof PersonaDbError ? e.status : 500;
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Unexpected error" },
    { status },
  );
}
