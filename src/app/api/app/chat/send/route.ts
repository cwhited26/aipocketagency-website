import { createClient } from "@/lib/supabase/server";
import { chatAsHomeEnabled } from "@/lib/chat/feature-flag";
import { insertMessage, findPersonaByName, ChatDbError } from "@/lib/chat/db";
import { SendMessageSchema, type ChatMessage } from "@/lib/chat/types";
import { parseIntent } from "@/lib/chat/filters";
import { fetchPaUser } from "@/lib/pa-supabase";
import { commitMemoryFile } from "@/lib/pa-brain";
import { loadChatInventory } from "@/lib/chat/connection-inventory";
import { runChatAgent, type AgentLlm, type AgentToolRunner } from "@/lib/chat/agent-loop";
import { executeTool } from "@/lib/chat/tools";
import { completeLlm } from "@/lib/llm/dispatch";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEMORY_PATH = "memory/active/chat-captures.md";

// Cap LLM output per step — answers + tool-call JSON are both short.
const AGENT_MAX_TOKENS = 1024;

// POST /api/app/chat/send  { content }
// Appends the user message, runs deterministic intent parsing (memory / persona fast-paths), and
// otherwise hands the message to the tool-aware agent loop: the LLM picks Connections to use,
// reads fire INLINE and stream their result into the chat, writes stage to the Approval Inbox.
// This replaces the old canned Wave-A fallback — the agent now knows (and uses) its Connections.
// Returns every row it appended so the client renders them in order.
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
      // Tool-aware agent: enumerate live Connections, run reads inline, stage writes for approval.
      out.push(...(await handleAgentTurn(user.id, content)));
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

// ── Generic message → tool-aware agent loop ──────────────────────────────────────────────
// Loads the user's live tool inventory, runs the LLM tool-use loop (reads inline, writes staged),
// and persists each emitted row: a tool_call card per fired Connection, then the final answer.
async function handleAgentTurn(userId: string, content: string): Promise<ChatMessage[]> {
  const inventory = await loadChatInventory(userId);

  const llm: AgentLlm = async ({ system, messages }) => {
    const res = await completeLlm({
      userId,
      paManagedKey: inventory.paManagedKey,
      system,
      messages,
      maxTokens: AGENT_MAX_TOKENS,
    });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, text: res.text };
  };

  const runTool: AgentToolRunner = (call) => executeTool(userId, inventory, call);

  const emits = await runChatAgent({ inventory, content, llm, runTool });

  const rows: ChatMessage[] = [];
  for (const emit of emits) {
    if (emit.role === "assistant") {
      rows.push(
        await insertMessage({ userId, role: "assistant", content: emit.content, filterTags: ["general"] }),
      );
    } else {
      rows.push(
        await insertMessage({
          userId,
          role: "inline_card",
          cardKind: emit.cardKind,
          cardPayload: emit.cardPayload,
          // Surface tool activity under both the home stream and the Connections view.
          filterTags: ["connections", "general"],
        }),
      );
    }
  }
  return rows;
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
// Surfaces the invocation and deep-links into the persona's full chat thread (where the existing
// persona LLM pipeline answers).
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
