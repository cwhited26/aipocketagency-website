import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { buildMemoryBlocks, parseCitations, formatMemoryBlocksForPrompt } from "@/lib/pa-brain";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  question: z.string().min(1).max(10_000),
});

type AnthropicMessage = {
  content: Array<{ type: "text"; text: string }>;
};

function buildSystemPrompt(memoryMarkup: string): string {
  return `You are the user's personal AI brain assistant. You have exclusive access to their memory files stored in their brain repository.

MEMORY FILES:
${memoryMarkup}

INSTRUCTIONS:
- Answer the user's question using ONLY the information in the memory files above.
- Every factual claim must be cited with the exact file path and line number, like: [memory/filename.md:42]
- If the memory files do not contain enough information to answer, say so clearly.
- Do not invent or infer information not present in the memory files.
- Be concise and direct.`;
}

export async function POST(req: Request): Promise<NextResponse> {
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
        message: "Add your Anthropic API key in Settings to start asking questions.",
      },
      { status: 402 },
    );
  }

  const memoryBlocks = await buildMemoryBlocks(brain_repo, github_token);
  if (memoryBlocks.length === 0) {
    return NextResponse.json({
      answer:
        "Your brain repo has no memory files yet. Add .md files to the memory/ folder and try again.",
      citations: [],
    });
  }

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
      system: buildSystemPrompt(formatMemoryBlocksForPrompt(memoryBlocks)),
      messages: [{ role: "user", content: parsed.data.question }],
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
