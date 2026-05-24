import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GhContentsItem = {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
};

type GhFileContent = {
  encoding: string;
  content: string;
};

type AnthropicMessage = {
  content: Array<{ type: "text"; text: string }>;
};

type Citation = { file: string; line: string };

const bodySchema = z.object({
  clientName: z.string().min(1).max(200),
  scopeDescription: z.string().min(1).max(5000),
  specifics: z.string().max(3000).optional().default(""),
});

async function listMemoryFiles(repo: string, token: string | null): Promise<GhContentsItem[]> {
  const hdrs: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) hdrs.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/memory`, {
    headers: hdrs,
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
  const hdrs: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "pocket-agent/1.0",
  };
  if (token) hdrs.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: hdrs,
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

function buildSystemPrompt(
  memoryBlocks: Array<{ path: string; content: string }>,
  clientName: string,
  scopeDescription: string,
  specifics: string,
): string {
  const hasMemory = memoryBlocks.length > 0;

  const blocks = hasMemory
    ? memoryBlocks
        .map(({ path, content }) => {
          const lines = content.split("\n");
          const numbered = lines.map((l, i) => `${i + 1}: ${l}`).join("\n");
          return `--- ${path} ---\n${numbered}`;
        })
        .join("\n\n")
    : "";

  const memorySection = hasMemory
    ? `BRAIN MEMORY FILES (your business context — services, pricing, voice, past decisions):
${blocks}

`
    : `NOTE: No brain memory files are connected yet. Draft the best quote you can from the inputs provided. At the end, list 2-3 specific things the user should add to their brain (services offered, standard pricing, terms of service, past client context) to make future quotes sharper and more personalized.

`;

  return `You are a skilled quote and proposal writer for an independent operator.

${memorySection}YOUR TASK:
Write a clean, professional quote/proposal for the following job. The output should sound like the operator wrote it — direct, specific, no filler — not like a template from a software package.

CLIENT: ${clientName}
SCOPE: ${scopeDescription}${specifics ? `\nADDITIONAL DETAILS: ${specifics}` : ""}

STRUCTURE THE QUOTE AS:
1. **Introduction** — one short paragraph. Who this is for, what it covers. No fluff.
2. **Scope of Work** — bulleted list of what's included. Specific line items derived from the scope description. If the brain has past project context, mirror the format used there.
3. **Investment** — pricing section. If the brain has pricing memory, use it. If not, write placeholder lines like "[PRICE — add your standard rate]" that the operator can fill in. Never invent numbers.
4. **Timeline** — if timeline info was provided, include it. Otherwise use "[TIMELINE]" placeholder.
5. **Terms** — 2-3 standard terms (payment schedule, revision rounds, what's excluded). Use brain terms if present; otherwise write sensible defaults.
6. **Next Step** — one sentence. What the client should do to move forward.

VOICE RULES:
- Write like the operator would write, not like a legal document or corporate proposal template.
- Short sentences. Specific language. No "I hope this finds you well," no "leveraging synergies," no filler.
- If the brain has a voice spec or communication style notes, follow them exactly.
- Every factual claim derived from memory must be cited: [memory/filename.md:line]
- If the brain doesn't have pricing or services info, still write a complete, useful draft — just use clear placeholders and note at the end what brain context would sharpen it.`;
}

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { clientName, scopeDescription, specifics } = parsed.data;

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }

  const paUser = paResult.data;
  if (!paUser?.anthropic_api_key) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message: "Add your Anthropic API key in Settings to generate quotes.",
      },
      { status: 402 },
    );
  }

  const { brain_repo, github_token, anthropic_api_key } = paUser;

  const memoryBlocks: Array<{ path: string; content: string }> = [];
  if (brain_repo) {
    const files = await listMemoryFiles(brain_repo, github_token);
    const fetched = await Promise.all(
      files.map(async (f) => ({
        path: f.path,
        content: await fetchFileContent(brain_repo, f.path, github_token),
      })),
    );
    memoryBlocks.push(...fetched);
  }

  const systemPrompt = buildSystemPrompt(memoryBlocks, clientName, scopeDescription, specifics);

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropic_api_key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Generate the quote/proposal now. Format it cleanly for copy-paste or light editing. Don't add any preamble before the quote — start directly with the Introduction section.`,
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return NextResponse.json({ error: `Anthropic error: ${errText}` }, { status: 502 });
  }

  const msg = (await anthropicRes.json()) as AnthropicMessage;
  const draft = msg.content.find((c) => c.type === "text")?.text ?? "";
  const citations = parseCitations(draft);

  return NextResponse.json({ draft, citations, hasBrain: memoryBlocks.length > 0 });
}
