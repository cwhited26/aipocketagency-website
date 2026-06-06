import { createClient } from "@/lib/supabase/server";
import { chatAsHomeEnabled } from "@/lib/chat/feature-flag";
import { insertMessage, findPersonaByName, ChatDbError } from "@/lib/chat/db";
import { SendMessageSchema, type ChatMessage } from "@/lib/chat/types";
import { parseIntent } from "@/lib/chat/filters";
import { fetchPaUser } from "@/lib/pa-supabase";
import { commitMemoryFile } from "@/lib/pa-brain";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEMORY_PATH = "memory/active/chat-captures.md";

// POST /api/app/chat/send  { content }
// Appends the user message, runs deterministic intent parsing (lib/chat/filters), and emits
// the matching inline card(s). Wave A makes existing features chat-reachable; it does NOT
// dispatch sub-agents (that is Wave B). Returns every row it appended so the client renders
// them in order.
export async function POST(req: Request): Promise<NextResponse> {
  if (!chatAsHomeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let content: string;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    content = SendMessageSchema.parse(raw).content;
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid request" : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const out: ChatMessage[] = [];
  try {
    // 1. Always persist the user's message in the home stream.
    out.push(
      await insertMessage({ userId: user.id, role: "user", content, filterTags: ["general"] }),
    );

    const intent = parseIntent(content);

    if (intent.kind === "memory") {
      out.push(...(await handleMemory(user.id, intent.content)));
    } else if (intent.kind === "persona") {
      out.push(...(await handlePersona(user.id, intent.personaQuery, intent.question)));
    } else {
      out.push(
        await insertMessage({
          userId: user.id,
          role: "assistant",
          content:
            "Got it — logged to your chat. In Wave A I can: save to memory (\"add to memory: …\"), " +
            "answer through a persona (\"ask my <persona>: …\"), capture voice (/capture voice), and " +
            "upload files (/upload). Full task execution — spawning sub-agents to do the work — arrives " +
            "with v5 Wave B.",
          filterTags: ["general"],
        }),
      );
    }

    return NextResponse.json({ messages: out });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid card payload" }, { status: 400 });
    }
    const status = e instanceof ChatDbError ? e.status : 500;
    return NextResponse.json({ error: "Could not process message", messages: out }, { status });
  }
}

// ── Memory intent → commit to brain + memory_write card ──────────────────────────────────
async function handleMemory(userId: string, note: string): Promise<ChatMessage[]> {
  const paResult = await fetchPaUser(userId);
  const paUser = paResult.ok ? paResult.data : null;

  if (!paUser?.brain_repo || !paUser.github_token) {
    return [
      await insertMessage({
        userId,
        role: "assistant",
        content:
          "I couldn't save that — no brain repo is connected yet. Connect one in Settings, then try again.",
        filterTags: ["brain"],
      }),
    ];
  }

  const stamp = new Date().toISOString();
  const entry = `## ${stamp}\n\n${note}`;
  const commit = await commitMemoryFile({
    repo: paUser.brain_repo,
    token: paUser.github_token,
    path: MEMORY_PATH,
    mode: "append",
    content: entry,
    commitMessage: `chat: capture memory note (${stamp.slice(0, 10)})`,
  });

  if (!commit.ok) {
    return [
      await insertMessage({
        userId,
        role: "assistant",
        content: `I couldn't write that to your brain: ${commit.error}`,
        filterTags: ["brain"],
      }),
    ];
  }

  return [
    await insertMessage({
      userId,
      role: "inline_card",
      cardKind: "memory_write",
      cardPayload: {
        summary: note,
        tier: "Active",
        path: MEMORY_PATH,
        sha: commit.sha,
      },
      filterTags: ["brain"],
    }),
  ];
}

// ── Persona intent → resolve persona + persona_invoke card ───────────────────────────────
// Wave A surfaces the invocation and deep-links into the persona's full chat thread (where
// the existing persona LLM pipeline answers). Inline answer streaming is a Wave B concern.
async function handlePersona(
  userId: string,
  personaQuery: string,
  question: string,
): Promise<ChatMessage[]> {
  const match = await findPersonaByName(userId, personaQuery);
  if (!match) {
    return [
      await insertMessage({
        userId,
        role: "assistant",
        content: `I couldn't find an active persona named "${personaQuery}". See your personas with /personas.`,
        filterTags: ["personas"],
      }),
    ];
  }

  return [
    await insertMessage({
      userId,
      role: "inline_card",
      cardKind: "persona_invoke",
      cardPayload: {
        personaId: match.id,
        personaName: match.name,
        question,
        openHref: `/app/personas/${match.id}`,
      },
      filterTags: ["personas"],
    }),
  ];
}
