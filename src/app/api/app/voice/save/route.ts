import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { commitMemoryFile } from "@/lib/pa-brain";
import {
  buildVoiceMemoMarkdown,
  voiceMemoSlug,
  voiceMemoPath,
  voiceMemoCommitMessage,
} from "@/lib/pa-voice";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SaveBodySchema = z.object({
  transcript: z.string().min(1, "Transcript is empty").max(200_000),
  topic: z.string().max(500).optional(),
  durationSeconds: z.number().int().nonnegative().max(86_400),
});

// POST /api/app/voice/save
// Commits a transcribed voice memo to the member's brain repo at
// inbox/voice-memos/YYYY-MM-DD/<HHMMSS>-<slug>.md and returns { sha, path }.
export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof SaveBodySchema>;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    body = SaveBodySchema.parse(raw);
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid request" : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }
  const paUser = paResult.data;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const ghToken = paUser.github_token ?? session?.provider_token ?? null;

  if (!paUser.brain_repo || !ghToken) {
    return NextResponse.json({ error: "No brain repo connected" }, { status: 400 });
  }

  // Server-stamped capture time is the single source of truth for both the
  // frontmatter and the file path, so they can never disagree.
  const capturedAt = new Date().toISOString();
  const topic = body.topic?.trim() ?? "";
  const slug = voiceMemoSlug(topic, body.transcript);
  const path = voiceMemoPath(capturedAt, slug);

  const markdown = buildVoiceMemoMarkdown({
    capturedAt,
    topic,
    durationSeconds: body.durationSeconds,
    transcript: body.transcript,
  });

  const commitResult = await commitMemoryFile({
    repo: paUser.brain_repo,
    token: ghToken,
    path,
    mode: "replace",
    content: markdown,
    commitMessage: voiceMemoCommitMessage(capturedAt, topic),
  });

  if (!commitResult.ok) {
    return NextResponse.json({ error: commitResult.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sha: commitResult.sha, path });
}
