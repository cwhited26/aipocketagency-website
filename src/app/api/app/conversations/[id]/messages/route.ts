import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  getConversation,
  getMessages,
  insertMessage,
  updateConversation,
  generateTitle,
} from "@/lib/pa-conversations";
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
  content: z.string().min(1).max(10_000),
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
  hasBrain: boolean,
): string {
  if (!hasBrain || memoryBlocks.length === 0) {
    return `You are the user's personal AI business partner. Your job is to help operators run their business — drafting, deciding, researching, summarizing.

No brain is connected yet. Explain helpfully that once the user connects a GitHub brain repo (containing memory/*.md files), you'll be able to give cited answers sourced from their actual business context. Until then, you can help with general questions but you're working without their specific business memory.

Keep it warm and direct. Don't repeat this disclaimer on every message — just acknowledge it once if relevant.`;
  }

  const blocks = memoryBlocks
    .map(({ path, content }) => {
      const lines = content.split("\n");
      const numbered = lines.map((l, i) => `${i + 1}: ${l}`).join("\n");
      return `--- ${path} ---\n${numbered}`;
    })
    .join("\n\n");

  return `You are the user's personal AI business partner — their chief of staff. You have exclusive access to their memory files stored in their brain repository.

MEMORY FILES:
${blocks}

INSTRUCTIONS:
- Answer using ONLY information from the memory files above. Carry context across the conversation.
- Every factual claim must be cited with the exact file path and line number, like: [memory/filename.md:42]
- If the memory files do not contain enough information, say so clearly and suggest what they might want to add to their brain.
- Be direct and honest — push back if a question has a better framing. Talk like a partner, not a chatbot.
- Do not invent or infer facts not in the files.`;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
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

  const { id: conversationId } = params;
  const { content } = parsed.data;

  // Verify conversation ownership
  const convResult = await getConversation(conversationId, user.id);
  if (!convResult.ok) {
    return NextResponse.json({ error: convResult.error }, { status: convResult.status });
  }
  if (!convResult.data) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  const conversation = convResult.data;

  // Load prior messages
  const priorResult = await getMessages(conversationId, user.id);
  if (!priorResult.ok) {
    return NextResponse.json({ error: priorResult.error }, { status: priorResult.status });
  }
  const priorMessages = priorResult.data;

  // Load user config
  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }

  const paUser = paResult.data;
  if (!paUser?.anthropic_api_key) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message: "Add your Anthropic API key in Settings to start conversations.",
      },
      { status: 402 },
    );
  }

  const { brain_repo, github_token, anthropic_api_key } = paUser;

  // Load memory files (if brain connected)
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

  // Save user message first
  const userMsgResult = await insertMessage({
    conversationId,
    userId: user.id,
    role: "user",
    content,
  });
  if (!userMsgResult.ok) {
    return NextResponse.json({ error: userMsgResult.error }, { status: userMsgResult.status });
  }

  // Build Anthropic messages (keep last 20 to stay within context)
  const historySlice = priorMessages.slice(-20);
  const anthropicMessages = [
    ...historySlice.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content },
  ];

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
      system: buildSystemPrompt(memoryBlocks, Boolean(brain_repo)),
      messages: anthropicMessages,
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return NextResponse.json({ error: `Anthropic error: ${errText}` }, { status: 502 });
  }

  const msg = (await anthropicRes.json()) as AnthropicMessage;
  const answerText = msg.content.find((c) => c.type === "text")?.text ?? "";

  // Save assistant message
  const asstMsgResult = await insertMessage({
    conversationId,
    userId: user.id,
    role: "assistant",
    content: answerText,
  });
  if (!asstMsgResult.ok) {
    return NextResponse.json({ error: asstMsgResult.error }, { status: asstMsgResult.status });
  }

  // Auto-title on first message exchange (conversation still has default title)
  let conversationTitle: string | undefined;
  if (conversation.title === "New conversation" && priorMessages.length === 0) {
    conversationTitle = generateTitle(content);
    await updateConversation(conversationId, user.id, { title: conversationTitle });
  }

  const citations = parseCitations(answerText);

  return NextResponse.json({
    userMessage: userMsgResult.data,
    assistantMessage: { ...asstMsgResult.data, citations },
    conversationTitle,
  });
}
