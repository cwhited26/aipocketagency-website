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
  recipient: z.string().min(1).max(200),
  relationship: z.string().max(500).optional().default(""),
  purpose: z.string().min(1).max(2000),
  keyPoints: z.string().max(3000).optional().default(""),
  tone: z.string().max(200).optional().default(""),
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
  recipient: string,
  relationship: string,
  purpose: string,
  keyPoints: string,
  tone: string,
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
    ? `BRAIN MEMORY FILES (the operator's business context, voice, communication style, client history):
${blocks}

`
    : `NOTE: No brain memory files are connected yet. Draft the best email you can from the inputs provided. At the end, note 2-3 specific things the user should add to their brain (voice spec, client communication patterns, relationship history) to make future email drafts more personalized and on-voice.

`;

  return `You are drafting an email on behalf of an independent operator. Your job is to write an email that sounds like THEM — not like a polished PR person, not like ChatGPT, not like a corporate account manager. Like them.

${memorySection}EMAIL CONTEXT:
TO: ${recipient}${relationship ? `\nRELATIONSHIP: ${relationship}` : ""}
PURPOSE: ${purpose}${keyPoints ? `\nKEY POINTS TO COVER:\n${keyPoints}` : ""}${tone ? `\nTONE NOTE: ${tone}` : ""}

VOICE RULES (apply these strictly):
- Read the brain's voice or communication style notes carefully. Write in that voice exactly.
- If no voice spec is in the brain, default to: short sentences, direct, specific, no padding. The kind of email a busy operator sends between jobs — not a carefully polished business letter.
- No "I hope this finds you well." No "circling back." No "just checking in." No "at your earliest convenience."
- Open with the first name or a single-line greeting that fits the relationship. Not "Hi [Name],"  — "Name —" or just the name if that's how they write.
- Frame the ask in the first sentence. Don't build up to it.
- Specific > vague. If the brain has context about the recipient, use it. Name the project, the date, the amount, the specific thing they discussed.
- Close with a single-action CTA. One thing. Not three options.
- Sign off as the operator does (check the brain for their sign-off pattern; default to "— [FirstName]" if not found).
- Every factual claim pulled from memory must be cited: [memory/filename.md:line]

STRUCTURE:
1. Greeting line (one line, no filler)
2. Purpose/ask — first sentence, direct
3. Body — key points, specific, short. Bullets if parallel items; prose if one continuous thought.
4. CTA — one action, one link, one decision
5. Sign-off

Output ONLY the email. No preamble, no "here's the draft:" wrapper. Start with the greeting line.`;
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

  const { recipient, relationship, purpose, keyPoints, tone } = parsed.data;

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }

  const paUser = paResult.data;
  if (!paUser?.anthropic_api_key) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message: "Add your Anthropic API key in Settings to draft emails.",
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

  const systemPrompt = buildSystemPrompt(
    memoryBlocks,
    recipient,
    relationship,
    purpose,
    keyPoints,
    tone,
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
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Write the email now. Start directly with the greeting line — no wrapper text, no "here's your email."`,
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
