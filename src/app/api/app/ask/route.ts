import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GhContentsItem = {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
  sha: string;
};

type GhFileContent = {
  name: string;
  path: string;
  encoding: string;
  content: string;
};

type AnthropicMessage = {
  content: Array<{ type: "text"; text: string }>;
};

type Citation = { file: string; line: string };

async function listMemoryFiles(
  repo: string,
  token: string | null,
): Promise<GhContentsItem[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/memory`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) return [];
  const items = (await res.json()) as GhContentsItem[];
  return items.filter((f) => f.type === "file" && f.name.endsWith(".md"));
}

async function fetchFileContent(
  repo: string,
  path: string,
  token: string | null,
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) return "";
  const data = (await res.json()) as GhFileContent;
  if (data.encoding === "base64") {
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
  }
  return data.content ?? "";
}

function parseCitations(text: string): Citation[] {
  const re = /\[?(memory\/[^\]:\s]+\.md)(?::(\d+))?\]?/g;
  const seen = new Set<string>();
  const citations: Citation[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = `${m[1]}:${m[2] ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({ file: m[1], line: m[2] ?? "" });
    }
  }
  return citations;
}

function buildSystemPrompt(memoryBlocks: Array<{ path: string; content: string }>): string {
  const blocks = memoryBlocks
    .map(({ path, content }) => {
      const lines = content.split("\n");
      const numbered = lines.map((l, i) => `${i + 1}: ${l}`).join("\n");
      return `--- ${path} ---\n${numbered}`;
    })
    .join("\n\n");

  return `You are the user's personal AI brain assistant. You have exclusive access to their memory files stored in their brain repository.

MEMORY FILES:
${blocks}

INSTRUCTIONS:
- Answer the user's question using ONLY the information in the memory files above.
- Every factual claim must be cited with the exact file path and line number, like: [memory/filename.md:42]
- If the memory files do not contain enough information to answer, say so clearly.
- Do not invent or infer information not present in the memory files.
- Be concise and direct.`;
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: { question?: unknown };
  try {
    body = (await req.json()) as { question?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data?.brain_repo) {
    return NextResponse.json({ error: "No brain repo connected" }, { status: 404 });
  }

  const { brain_repo, github_token, anthropic_api_key } = paResult.data;

  if (!anthropic_api_key) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message:
          "Add your Anthropic API key in Settings to start asking questions.",
      },
      { status: 402 },
    );
  }

  const files = await listMemoryFiles(brain_repo, github_token);
  if (files.length === 0) {
    return NextResponse.json({
      answer:
        "Your brain repo has no memory files yet. Add .md files to the memory/ folder and try again.",
      citations: [],
    });
  }

  const memoryBlocks = await Promise.all(
    files.map(async (f) => ({
      path: f.path,
      content: await fetchFileContent(brain_repo, f.path, github_token),
    })),
  );

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropic_api_key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: buildSystemPrompt(memoryBlocks),
      messages: [{ role: "user", content: question }],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return NextResponse.json({ error: `Anthropic error: ${errText}` }, { status: 502 });
  }

  const msg = (await anthropicRes.json()) as AnthropicMessage;
  const answer = msg.content.find((c) => c.type === "text")?.text ?? "";
  const citations = parseCitations(answer);

  return NextResponse.json({ answer, citations });
}
