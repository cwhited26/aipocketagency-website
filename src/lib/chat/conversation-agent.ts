// lib/chat/conversation-agent.ts — the brain-aware agent loop for HEADLESS conversation turns: a
// surface that has no interactive HTTP session of its own and must run as a known owner.
//
// Today's caller is the inbound Slack DM webhook (POST /api/connectors/slack/events): the owner
// messages the bot, and we run their brain agent and persist the exchange with no logged-in
// request. `runConversationTurn` owns the whole turn — load-history → persist-user → run →
// persist-assistant → auto-title — parameterized by an origin-metadata blob so the surface (e.g. a
// Slack DM) renders its own chip in the thread.
//
// This deliberately mirrors the interactive Ask-box route's brain agent loop (same tools, same
// system prompt) rather than importing it: that route is project-aware and tightly coupled to an
// authenticated request + multipart uploads, and the Slack path needs neither. Keeping the headless
// runner self-contained means an in-flight change to the interactive route can't break inbound DMs.
// The tool set here is the brain core (read/list, draft quote/email, propose brain update); the
// Slack thread is never a project thread, so the route-only `save_to_project` tool isn't offered.

import { z } from "zod";
import { listMemoryFiles, fetchFileContent } from "@/lib/pa-brain";
import { generateQuoteDraft, generateEmailDraft } from "@/lib/pa-drafts";
import { createPendingAction } from "@/lib/pa-actions";
import {
  loadZoneConfig,
  assertReadAllowed,
  ContainmentBlockedError,
  type ZoneConfig,
} from "@/lib/brain/containment-guard";
import { tieredPathForNewMemory } from "@/lib/brain/memory-tier";
import {
  getMessages,
  insertMessage,
  getConversation,
  updateConversation,
  generateTitle,
} from "@/lib/pa-conversations";
import type { PaUser } from "@/lib/pa-supabase";

// ── Anthropic wire types ───────────────────────────────────────────────────────

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

export type AnthropicLoopMessage =
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

// ── Agent tools ────────────────────────────────────────────────────────────────

export const AGENT_TOOLS: ToolDefinition[] = [
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

// ── Agent system prompt ──────────────────────────────────────────────────────

export function buildAgentSystemPrompt(hasBrain: boolean): string {
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

export type AgentToolContext = {
  userId: string;
  brain_repo: string | null;
  github_token: string | null;
  anthropic_api_key: string;
  zoneConfig: ZoneConfig;
};

export async function executeAgentTool(
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

export function describeToolCall(name: string, input: Record<string, unknown>): string {
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

// ── The loop ──────────────────────────────────────────────────────────────────

const DEFAULT_MAX_ITERATIONS = 6;

export type AgentLoopResult =
  | { ok: true; finalAnswer: string; toolSteps: ToolStep[] }
  | { ok: false; status: number; error: string };

/**
 * Run the Anthropic tool-use loop for one assembled turn. `loopMessages` already includes the new
 * user message (and any prior history); `ctx` carries the brain + API key + privacy-zone config.
 * Returns the final answer text and the ordered tool steps, or a typed error on an API failure.
 */
export async function runAgentLoop(opts: {
  loopMessages: AnthropicLoopMessage[];
  systemPrompt: string;
  ctx: AgentToolContext;
  maxIterations?: number;
}): Promise<AgentLoopResult> {
  const loopMessages = [...opts.loopMessages];
  const toolSteps: ToolStep[] = [];
  const maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  let finalAnswer = "";
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": opts.ctx.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: opts.systemPrompt,
        tools: AGENT_TOOLS,
        messages: loopMessages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return { ok: false, status: 502, error: `Anthropic error: ${errText}` };
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
        const result = await executeAgentTool(block.name, block.input, opts.ctx);
        toolSteps.push({ tool: block.name, label: describeToolCall(block.name, block.input) });
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }

      loopMessages.push({ role: "user", content: toolResults });
      continue;
    }

    // max_tokens or unexpected stop — use whatever text we have.
    finalAnswer = response.content.find((c) => c.type === "text")?.text ?? "";
    if (iteration >= maxIterations && !finalAnswer) {
      finalAnswer = "Reached maximum reasoning steps. Please try again with a more specific question.";
    }
    break;
  }

  if (!finalAnswer && iteration >= maxIterations) {
    finalAnswer = "Reached maximum reasoning steps without a complete response. Please try again.";
  }

  return { ok: true, finalAnswer, toolSteps };
}

// ── Headless turn (Slack inbound + any non-interactive surface) ─────────────────

export type ConversationTurnResult =
  | { ok: true; finalAnswer: string; toolSteps: ToolStep[] }
  | { ok: false; status: number; error: string };

/**
 * Run one full conversation turn for a known owner without an interactive HTTP session: persist the
 * user message (tagged with `userMetadata` so the surface can render its origin chip), run the
 * agent over their brain, persist the assistant reply, and auto-title a brand-new thread. Used by
 * the inbound Slack webhook; the interactive Ask-box route shares only `runAgentLoop` because it
 * also handles uploads.
 */
export async function runConversationTurn(opts: {
  paUser: PaUser;
  userId: string;
  conversationId: string;
  content: string;
  userMetadata?: unknown;
}): Promise<ConversationTurnResult> {
  const { paUser, userId, conversationId, content } = opts;
  if (!paUser.anthropic_api_key) {
    return { ok: false, status: 402, error: "no_api_key" };
  }

  const convResult = await getConversation(conversationId, userId);
  if (!convResult.ok) return { ok: false, status: convResult.status, error: convResult.error };
  if (!convResult.data) return { ok: false, status: 404, error: "Conversation not found" };
  const conversation = convResult.data;

  const priorResult = await getMessages(conversationId, userId);
  if (!priorResult.ok) return { ok: false, status: priorResult.status, error: priorResult.error };
  const priorMessages = priorResult.data;

  const userMsgResult = await insertMessage({
    conversationId,
    userId,
    role: "user",
    content,
    metadata: opts.userMetadata,
  });
  if (!userMsgResult.ok) {
    return { ok: false, status: userMsgResult.status, error: userMsgResult.error };
  }

  const { brain_repo, github_token, anthropic_api_key } = paUser;

  const loopMessages: AnthropicLoopMessage[] = [
    ...priorMessages.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content },
  ];

  const { config: zoneConfig } = brain_repo
    ? await loadZoneConfig(brain_repo, github_token)
    : { config: { zones: {} } as ZoneConfig };

  const loop = await runAgentLoop({
    loopMessages,
    systemPrompt: buildAgentSystemPrompt(Boolean(brain_repo)),
    ctx: { userId, brain_repo, github_token, anthropic_api_key, zoneConfig },
  });
  if (!loop.ok) return loop;

  const asstMsgResult = await insertMessage({
    conversationId,
    userId,
    role: "assistant",
    content: loop.finalAnswer,
  });
  if (!asstMsgResult.ok) {
    return { ok: false, status: asstMsgResult.status, error: asstMsgResult.error };
  }

  // Auto-title a brand-new thread from the first message so the Hub list reads sensibly.
  if (conversation.title === "New conversation" && priorMessages.length === 0) {
    await updateConversation(conversationId, userId, { title: generateTitle(content) });
  }

  return { ok: true, finalAnswer: loop.finalAnswer, toolSteps: loop.toolSteps };
}
