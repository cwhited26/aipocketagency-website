import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import {
  getConversation,
  getMessages,
  insertMessage,
  updateConversation,
  generateTitle,
} from "@/lib/pa-conversations";
import { listMemoryFiles, fetchFileContent, parseCitations } from "@/lib/pa-brain";
import { generateQuoteDraft, generateEmailDraft } from "@/lib/pa-drafts";
import { createPendingAction } from "@/lib/pa-actions";
import {
  loadZoneConfig,
  assertReadAllowed,
  ContainmentBlockedError,
  type ZoneConfig,
} from "@/lib/brain/containment-guard";
import { tieredPathForNewMemory } from "@/lib/brain/memory-tier";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Types ────────────────────────────────────────────────────────────────────

type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
};

type AnthropicAssistantBlock = AnthropicTextBlock | AnthropicToolUseBlock;

type AnthropicLoopMessage =
  | { role: "user"; content: string | AnthropicToolResultBlock[] }
  | { role: "assistant"; content: string | AnthropicAssistantBlock[] };

type AnthropicApiResponse = {
  content: AnthropicAssistantBlock[];
  stop_reason: string;
};

export type ToolStep = {
  tool: string;
  label: string;
};

type ToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required: string[];
  };
};

// ── Agent tools ──────────────────────────────────────────────────────────────

const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: "list_brain_files",
    description:
      "Lists all memory files available in the user's brain repository. Call this to discover what context is available before reading specific files.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_brain_file",
    description:
      "Reads the full content of a specific memory file. Use this to load context relevant to the user's question before answering.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path, e.g. memory/pricing.md" },
      },
      required: ["path"],
    },
  },
  {
    name: "draft_quote",
    description:
      "Generates a complete professional quote/proposal using the user's brain context. Returns the full draft text. Use when the user asks to write or draft a quote or proposal.",
    input_schema: {
      type: "object",
      properties: {
        client: { type: "string", description: "Client or customer name" },
        scope: { type: "string", description: "Description of the scope of work or project" },
        specifics: {
          type: "string",
          description: "Additional details: timeline, budget signals, special requirements",
        },
      },
      required: ["client", "scope"],
    },
  },
  {
    name: "draft_email",
    description:
      "Generates an email in the user's voice using their brain context. Returns the complete email text. Use when the user asks to write or draft an email.",
    input_schema: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "Who the email is to" },
        relationship: { type: "string", description: "The relationship with the recipient" },
        purpose: { type: "string", description: "What the email is about / the main ask" },
        key_points: { type: "string", description: "Key points to cover" },
        tone: { type: "string", description: "Tone guidance, e.g. warm, direct, formal" },
      },
      required: ["recipient", "purpose"],
    },
  },
  {
    name: "propose_brain_update",
    description:
      "Proposes an update to a file in the user's brain repository. This does NOT execute immediately — it creates a pending approval the user must review and confirm in their Inbox before anything changes. Use this when important information from the conversation should be saved to the brain. Never call this without a clear, specific reason.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "The memory file path to update, e.g. memory/project_acme.md. Must start with 'memory/' and end with '.md'.",
        },
        mode: {
          type: "string",
          description:
            "'append' to add a new section below existing content, 'replace' to overwrite the entire file.",
        },
        content: {
          type: "string",
          description:
            "The content to write. For 'append': the new section to add. For 'replace': the complete new file content including any frontmatter.",
        },
        why: {
          type: "string",
          description:
            "Human-readable explanation of why this brain update is proposed. The user sees this before deciding to approve or reject.",
        },
      },
      required: ["path", "mode", "content", "why"],
    },
  },
];

// ── Zod schemas for tool input validation ────────────────────────────────────

const readBrainFileInputSchema = z.object({
  path: z.string().min(1).max(500),
});

const draftQuoteInputSchema = z.object({
  client: z.string().min(1).max(200),
  scope: z.string().min(1).max(5000),
  specifics: z.string().max(3000).optional().default(""),
});

const draftEmailInputSchema = z.object({
  recipient: z.string().min(1).max(200),
  relationship: z.string().max(500).optional().default(""),
  purpose: z.string().min(1).max(2000),
  key_points: z.string().max(3000).optional().default(""),
  tone: z.string().max(200).optional().default(""),
});

const proposeBrainUpdateInputSchema = z.object({
  path: z.string().regex(/^memory\/(?:[a-z][a-z0-9-]*\/)?[^/]+\.md$/, "path must match memory/*.md"),
  mode: z.enum(["append", "replace"]),
  content: z.string().min(1).max(50_000),
  why: z.string().min(1).max(2000),
});

// ── Incoming request schema ───────────────────────────────────────────────────

const bodySchema = z.object({
  content: z.string().min(1).max(10_000),
});

// ── Agent system prompt ───────────────────────────────────────────────────────

function buildAgentSystemPrompt(hasBrain: boolean): string {
  if (!hasBrain) {
    return `You are the user's personal AI business partner. No brain repository is connected yet. If the user asks questions that require their specific business context, let them know once — then help with what you can from the information they provide in the conversation. Be direct; talk like a partner.`;
  }
  return `You are the user's personal AI business partner — their chief of staff. You have access to their brain repository via tools.

TOOLS AVAILABLE:
- list_brain_files: Discover what memory files exist in the brain
- read_brain_file: Load the content of a specific file before referencing it
- draft_quote: Generate a complete professional quote/proposal
- draft_email: Draft an email in the user's voice
- propose_brain_update: Propose saving new information to the brain (creates a pending approval — nothing writes until the user approves in their Inbox)

HOW TO WORK:
- For questions requiring business context, first read the relevant memory files, then answer with citations: [memory/filename.md:line]
- For quote or email requests, gather necessary details from the conversation then call the appropriate draft tool
- When the user shares important information (new client details, project decisions, pricing changes, preferences) that should be remembered, call propose_brain_update to stage it for their approval. Tell them you've proposed the update and they can review it in their Inbox
- Be direct and honest — push back when a question has a better framing. Talk like a partner, not a chatbot
- Carry context across the conversation; reference what you've already seen

BRAIN UPDATE RULES:
- Only propose updates for genuinely valuable, durable business information — not transient details
- Always include a clear, honest 'why' so the user understands what they're approving
- Use mode='append' when adding to an existing topic; 'replace' only when content is stale and should be overwritten entirely
- Never propose a brain update unless you have read the relevant existing file first (so you know what's already there)`;
}

// ── Tool executor ─────────────────────────────────────────────────────────────

type AgentToolContext = {
  userId: string;
  brain_repo: string | null;
  github_token: string | null;
  anthropic_api_key: string;
  zoneConfig: ZoneConfig;
};

async function executeAgentTool(
  name: string,
  rawInput: Record<string, unknown>,
  ctx: AgentToolContext,
): Promise<string> {
  if (name === "list_brain_files") {
    if (!ctx.brain_repo) return "No brain repository connected.";
    const files = await listMemoryFiles(ctx.brain_repo, ctx.github_token);
    if (files.length === 0) return "No memory files found in the brain repository.";
    return files.map((f) => f.path).join("\n");
  }

  if (name === "read_brain_file") {
    const parsed = readBrainFileInputSchema.safeParse(rawInput);
    if (!parsed.success) return `Invalid input: ${parsed.error.message}`;
    if (!ctx.brain_repo) return "No brain repository connected.";
    // ContainmentGuard: refuse to read user-private files into the agent's context.
    try {
      assertReadAllowed(parsed.data.path, ctx.zoneConfig, "agent-read");
    } catch (err) {
      if (err instanceof ContainmentBlockedError) return err.userMessage;
      throw err;
    }
    const content = await fetchFileContent(ctx.brain_repo, parsed.data.path, ctx.github_token);
    return content || `File not found or empty: ${parsed.data.path}`;
  }

  if (name === "draft_quote") {
    const parsed = draftQuoteInputSchema.safeParse(rawInput);
    if (!parsed.success) return `Invalid input: ${parsed.error.message}`;
    try {
      const result = await generateQuoteDraft(
        {
          clientName: parsed.data.client,
          scopeDescription: parsed.data.scope,
          specifics: parsed.data.specifics,
        },
        ctx.anthropic_api_key,
        ctx.brain_repo,
        ctx.github_token,
      );
      return result.draft;
    } catch (err) {
      return `Draft failed: ${err instanceof Error ? err.message : "Unknown error"}`;
    }
  }

  if (name === "draft_email") {
    const parsed = draftEmailInputSchema.safeParse(rawInput);
    if (!parsed.success) return `Invalid input: ${parsed.error.message}`;
    try {
      const result = await generateEmailDraft(
        {
          recipient: parsed.data.recipient,
          relationship: parsed.data.relationship,
          purpose: parsed.data.purpose,
          keyPoints: parsed.data.key_points,
          tone: parsed.data.tone,
        },
        ctx.anthropic_api_key,
        ctx.brain_repo,
        ctx.github_token,
      );
      return result.draft;
    } catch (err) {
      return `Draft failed: ${err instanceof Error ? err.message : "Unknown error"}`;
    }
  }

  if (name === "propose_brain_update") {
    const parsed = proposeBrainUpdateInputSchema.safeParse(rawInput);
    if (!parsed.success) return `Invalid input: ${parsed.error.message}`;
    if (!ctx.brain_repo) {
      return "No brain repository connected — cannot propose brain updates.";
    }

    // Memory tiers: route a brand-new flat memory/*.md write into the correct tier
    // folder (work/knowledge/learning) via the rules engine. Existing files keep
    // their path so we never move a user's established memories.
    let writePath = parsed.data.path;
    let tierNote = "";
    if (parsed.data.mode === "replace") {
      const existing = await fetchFileContent(ctx.brain_repo, parsed.data.path, ctx.github_token);
      if (!existing) {
        const routed = tieredPathForNewMemory(parsed.data.path, parsed.data.content);
        if (routed.tier) {
          writePath = routed.path;
          tierNote = ` Filed under ${routed.tier} (${routed.reason}).`;
        }
      }
    }

    const result = await createPendingAction({
      userId: ctx.userId,
      actionType: "update_brain_memory",
      title: `Update ${writePath}`,
      summary: parsed.data.why,
      payload: {
        repo: ctx.brain_repo,
        path: writePath,
        mode: parsed.data.mode,
        content: parsed.data.content,
      },
    });

    if (!result.ok) {
      return `Failed to create proposal: ${result.error}`;
    }

    return `Proposed — a brain update for ${writePath} (mode: ${parsed.data.mode}) is now pending in the user's Inbox.${tierNote} Nothing has been written yet. The user must review the proposed content and click Approve before anything changes in their brain.`;
  }

  return `Unknown tool: ${name}`;
}

function describeToolCall(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "list_brain_files":
      return "Listed brain files";
    case "read_brain_file":
      return `Read ${typeof input.path === "string" ? input.path : "file"}`;
    case "draft_quote":
      return `Drafted quote for ${typeof input.client === "string" ? input.client : "client"}`;
    case "draft_email":
      return `Drafted email to ${typeof input.recipient === "string" ? input.recipient : "recipient"}`;
    case "propose_brain_update":
      return `Proposed brain update: ${typeof input.path === "string" ? input.path : "memory file"} (${typeof input.mode === "string" ? input.mode : "update"})`;
    default:
      return `Called ${name}`;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

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

  const convResult = await getConversation(conversationId, user.id);
  if (!convResult.ok) {
    return NextResponse.json({ error: convResult.error }, { status: convResult.status });
  }
  if (!convResult.data) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  const conversation = convResult.data;

  const priorResult = await getMessages(conversationId, user.id);
  if (!priorResult.ok) {
    return NextResponse.json({ error: priorResult.error }, { status: priorResult.status });
  }
  const priorMessages = priorResult.data;

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

  // Persist user message first
  const userMsgResult = await insertMessage({
    conversationId,
    userId: user.id,
    role: "user",
    content,
  });
  if (!userMsgResult.ok) {
    return NextResponse.json({ error: userMsgResult.error }, { status: userMsgResult.status });
  }

  // Build the message history for the loop (last 20 prior messages + new user message)
  const historySlice = priorMessages.slice(-20);
  const loopMessages: AnthropicLoopMessage[] = [
    ...historySlice.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content },
  ];

  // Load the brain's privacy-zone config once per request for the ContainmentGuard.
  const { config: zoneConfig } = brain_repo
    ? await loadZoneConfig(brain_repo, github_token)
    : { config: { zones: {} } as ZoneConfig };

  const agentCtx: AgentToolContext = {
    userId: user.id,
    brain_repo,
    github_token,
    anthropic_api_key,
    zoneConfig,
  };
  const systemPrompt = buildAgentSystemPrompt(Boolean(brain_repo));
  const toolSteps: ToolStep[] = [];

  const MAX_ITERATIONS = 6;
  let finalAnswer = "";
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        tools: AGENT_TOOLS,
        messages: loopMessages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return NextResponse.json({ error: `Anthropic error: ${errText}` }, { status: 502 });
    }

    const response = (await anthropicRes.json()) as AnthropicApiResponse;

    if (response.stop_reason === "end_turn") {
      finalAnswer = response.content.find((c) => c.type === "text")?.text ?? "";
      break;
    }

    if (response.stop_reason === "tool_use") {
      loopMessages.push({ role: "assistant", content: response.content });

      const toolResults: AnthropicToolResultBlock[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const result = await executeAgentTool(block.name, block.input, agentCtx);
        toolSteps.push({ tool: block.name, label: describeToolCall(block.name, block.input) });
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }

      loopMessages.push({ role: "user", content: toolResults });
      continue;
    }

    // max_tokens or unexpected stop — use whatever text we have
    finalAnswer = response.content.find((c) => c.type === "text")?.text ?? "";
    if (iteration >= MAX_ITERATIONS && !finalAnswer) {
      finalAnswer = "Reached maximum reasoning steps. Please try again with a more specific question.";
    }
    break;
  }

  if (!finalAnswer && iteration >= MAX_ITERATIONS) {
    finalAnswer = "Reached maximum reasoning steps without a complete response. Please try again.";
  }

  // Persist assistant message
  const asstMsgResult = await insertMessage({
    conversationId,
    userId: user.id,
    role: "assistant",
    content: finalAnswer,
  });
  if (!asstMsgResult.ok) {
    return NextResponse.json({ error: asstMsgResult.error }, { status: asstMsgResult.status });
  }

  // Auto-title on first message exchange
  let conversationTitle: string | undefined;
  if (conversation.title === "New conversation" && priorMessages.length === 0) {
    conversationTitle = generateTitle(content);
    await updateConversation(conversationId, user.id, { title: conversationTitle });
  }

  const citations = parseCitations(finalAnswer);

  return NextResponse.json({
    userMessage: userMsgResult.data,
    assistantMessage: { ...asstMsgResult.data, citations, toolSteps },
    conversationTitle,
  });
}
