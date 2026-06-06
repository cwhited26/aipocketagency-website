import { createClient } from "@/lib/supabase/server";
import { chatAsHomeEnabled } from "@/lib/chat/feature-flag";
import { insertMessage, ChatDbError } from "@/lib/chat/db";
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

const BodySchema = z.object({
  transcript: z.string().min(1, "Transcript is empty").max(200_000),
  durationSeconds: z.number().int().nonnegative().max(86_400),
  topic: z.string().max(500).optional(),
});

// POST /api/app/chat/voice  { transcript, durationSeconds, topic? }
// Commits the voice memo to the brain (same path as the standalone capture) AND appends a
// voice_memo inline card to the chat. Returns the new card so the client renders it inline.
export async function POST(req: Request): Promise<NextResponse> {
  if (!chatAsHomeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    body = BodySchema.parse(raw);
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid request" : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const paResult = await fetchPaUser(user.id);
  const paUser = paResult.ok ? paResult.data : null;
  if (!paUser?.brain_repo || !paUser.github_token) {
    return NextResponse.json({ error: "No brain repo connected" }, { status: 400 });
  }

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

  const commit = await commitMemoryFile({
    repo: paUser.brain_repo,
    token: paUser.github_token,
    path,
    mode: "replace",
    content: markdown,
    commitMessage: voiceMemoCommitMessage(capturedAt, topic),
  });
  if (!commit.ok) {
    return NextResponse.json({ error: commit.error }, { status: 502 });
  }

  try {
    const card = await insertMessage({
      userId: user.id,
      role: "inline_card",
      cardKind: "voice_memo",
      cardPayload: {
        durationSeconds: body.durationSeconds,
        transcriptSnippet: body.transcript.slice(0, 400),
        path,
        openHref: "/app/brain/inbox",
      },
      filterTags: ["capture"],
    });
    return NextResponse.json({ card });
  } catch (e) {
    const status = e instanceof ChatDbError ? e.status : 500;
    return NextResponse.json({ error: "Saved to brain but could not append the card" }, { status });
  }
}
