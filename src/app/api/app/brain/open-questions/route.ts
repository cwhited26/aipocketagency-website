// [2026-06-17] Claude Code — Open questions answer endpoint.
// Reads the brain open-questions file, injects the owner's answer under the matching
// heading, and commits the result. The extractOpenQuestionEntries parser then skips
// any entry whose body starts with **Answered, so the counter decrements naturally
// on the next graph fetch.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent, commitMemoryFile } from "@/lib/pa-brain";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  filePath: z.string().min(1).max(500),
  questionName: z.string().min(1).max(500),
  answer: z.string().min(1).max(10000),
});

export type AnswerQuestionRequest = z.infer<typeof BodySchema>;
export type AnswerQuestionResponse = { ok: true; sha: string };

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*|__|\*|_|`/g, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim();
}

// Injects **Answered (date):** block after the heading whose stripped text equals
// questionName, before the next heading. Returns null when the heading is not found.
function injectAnswer(content: string, questionName: string, answer: string): string | null {
  const lines = content.split("\n");
  let headingIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#{2,3}\s+(.+)$/);
    if (!m) continue;
    if (stripInlineMarkdown(m[1]) === questionName) {
      headingIdx = i;
      break;
    }
  }

  if (headingIdx === -1) return null;

  // Find the end of this section — the next heading or end of file.
  let endIdx = lines.length;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^#{2,3}\s+\S/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  // Trim trailing blank lines from the section body before inserting.
  let insertAt = endIdx;
  while (insertAt > headingIdx + 1 && lines[insertAt - 1].trim() === "") {
    insertAt -= 1;
  }

  const date = new Date().toISOString().slice(0, 10);
  const answerBlock = ["", `**Answered (${date}):** ${answer.trim()}`];

  return [
    ...lines.slice(0, insertAt),
    ...answerBlock,
    ...(endIdx < lines.length ? [""] : []),
    ...lines.slice(endIdx),
  ].join("\n");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = (await req.json()) as unknown;
    body = BodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data?.brain_repo) {
    return NextResponse.json({ error: "No brain connected" }, { status: 404 });
  }
  const { brain_repo, github_token } = paResult.data;
  if (!github_token) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 403 });
  }

  const existing = await fetchFileContent(brain_repo, body.filePath, github_token);
  if (!existing) {
    return NextResponse.json({ error: "Question file not found" }, { status: 404 });
  }

  const updated = injectAnswer(existing, body.questionName, body.answer);
  if (!updated) {
    return NextResponse.json({ error: "Question not found in file" }, { status: 404 });
  }

  const commit = await commitMemoryFile({
    repo: brain_repo,
    token: github_token,
    path: body.filePath,
    mode: "replace",
    content: updated,
    commitMessage: `brain: answer open question — ${body.questionName.slice(0, 72)}`,
  });

  if (!commit.ok) {
    return NextResponse.json({ error: commit.error }, { status: 502 });
  }

  const response: AnswerQuestionResponse = { ok: true, sha: commit.sha };
  return NextResponse.json(response);
}
