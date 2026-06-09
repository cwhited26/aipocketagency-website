// agent.ts — the agent turn the mobile capture endpoint runs after an iOS Shortcut posts a
// photo. It mirrors the Ask box's tool-use loop (brain read + draft + propose-brain-update),
// but is packaged as one reusable function so the mobile route stays thin. Direct REST to the
// Anthropic Messages API — no SDK (repo rule). Never throws on an API/parse failure; it returns
// a typed { ok:false } so the route can answer the Shortcut in plain text (no silent catch).

import { z } from "zod";
import { logCostFromUsage, type CostContext } from "@/lib/cost/log";
import { listMemoryFiles, fetchFileContent } from "@/lib/pa-brain";
import { generateQuoteDraft, generateEmailDraft } from "@/lib/pa-drafts";
import { createPendingAction } from "@/lib/pa-actions";
import {
  assertReadAllowed,
  ContainmentBlockedError,
  type ZoneConfig,
} from "@/lib/brain/containment-guard";
import { tieredPathForNewMemory } from "@/lib/brain/memory-tier";

// House model — matches the Ask box loop (conversations/[id]/messages route).
const AGENT_MODEL = "claude-sonnet-4-6";
const MAX_ITERATIONS = 6;

// ── Anthropic wire types ─────────────────────────────────────────────────────────────

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
  usage?: { input_tokens?: number; output_tokens?: number };
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

export type ToolStep = { tool: string; label: string };

// ── Tool surface (same set the Ask box exposes) ───────────────────────────────────────

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

// ── Tool input validation ──────────────────────────────────────────────────────────────

const readBrainFileInputSchema = z.object({ path: z.string().min(1).max(500) });
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

// ── System prompt ──────────────────────────────────────────────────────────────────────

function buildSystemPrompt(hasBrain: boolean): string {
  if (!hasBrain) {
    return `You are the user's personal AI business partner. No brain repository is connected yet. If the user asks questions that require their specific business context, let them know once — then help with what you can from the information they provide. Be direct; talk like a partner.

This message came in from the user's phone: they snapped a photo and it was read for you (the extracted text and a description ride inside the message). Answer about what they sent, concisely — your reply is shown directly on their phone.`;
  }
  return `You are the user's personal AI business partner — their chief of staff. You have access to their brain repository via tools.

This message came in from the user's phone: they snapped a photo with their iPhone and it was read for you. The extracted text and a plain-English description of the image ride inside the user's message. Answer about what they sent.

TOOLS AVAILABLE:
- list_brain_files: Discover what memory files exist in the brain
- read_brain_file: Load the content of a specific file before referencing it
- draft_quote: Generate a complete professional quote/proposal
- draft_email: Draft an email in the user's voice
- propose_brain_update: Propose saving new information to the brain (creates a pending approval — nothing writes until the user approves in their Inbox)

HOW TO WORK:
- For questions requiring business context, first read the relevant memory files, then answer with citations: [memory/filename.md:line]
- For quote or email requests, gather necessary details then call the appropriate draft tool
- When the photo carries important durable information (a new client's details, a signed quote, an invoice, a business card), call propose_brain_update to stage it for the owner's approval and tell them it's waiting in their Inbox
- Be direct and concise — your reply is shown on the owner's phone right after they snap the photo. Lead with the answer.`;
}

// ── Tool executor ──────────────────────────────────────────────────────────────────────

export type AgentToolContext = {
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
    if (!ctx.brain_repo) return "No brain repository connected — cannot propose brain updates.";

    // Route a brand-new flat memory/*.md write into the correct tier folder; keep existing
    // files where they are so we never move an established memory.
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
    if (!result.ok) return `Failed to create proposal: ${result.error}`;

    return `Proposed — a brain update for ${writePath} (mode: ${parsed.data.mode}) is now pending in the user's Inbox.${tierNote} Nothing has been written yet.`;
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
      return `Proposed brain update: ${typeof input.path === "string" ? input.path : "memory file"}`;
    default:
      return `Called ${name}`;
  }
}

// ── Runner ─────────────────────────────────────────────────────────────────────────────

export type PriorTurn = { role: "user" | "assistant"; content: string };

export type AgentRunResult =
  | { ok: true; answer: string; toolSteps: ToolStep[] }
  | { ok: false; error: string };

/**
 * Runs one agent turn: feeds prior turns + the new user content through the tool-use loop and
 * returns the final plain-text answer. Pure orchestration over the Anthropic Messages API and
 * the brain tools — the caller owns persistence. Returns { ok:false } on an Anthropic transport
 * error so the route can surface a plain-text reason to the Shortcut.
 */
export async function runAgentTurn(params: {
  userContent: string;
  priorTurns: PriorTurn[];
  ctx: AgentToolContext;
  /** When set, one anthropic cost event is logged per loop iteration (key suffixed by iteration). */
  cost?: CostContext;
}): Promise<AgentRunResult> {
  const { ctx } = params;
  const loopMessages: AnthropicLoopMessage[] = [
    ...params.priorTurns.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: params.userContent },
  ];
  const systemPrompt = buildSystemPrompt(Boolean(ctx.brain_repo));
  const toolSteps: ToolStep[] = [];

  let finalAnswer = "";
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ctx.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: AGENT_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        tools: AGENT_TOOLS,
        messages: loopMessages,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      return { ok: false, error: `Anthropic error (${res.status}): ${errText.slice(0, 200)}` };
    }

    const response = (await res.json()) as AnthropicApiResponse;

    if (params.cost) {
      await logCostFromUsage(
        { ...params.cost, idempotencyKey: `${params.cost.idempotencyKey}:${iteration}` },
        "anthropic",
        AGENT_MODEL,
        { tokensInput: response.usage?.input_tokens ?? 0, tokensOutput: response.usage?.output_tokens ?? 0 },
      );
    }

    if (response.stop_reason === "end_turn") {
      finalAnswer = response.content.find((c) => c.type === "text")?.text ?? "";
      break;
    }

    if (response.stop_reason === "tool_use") {
      loopMessages.push({ role: "assistant", content: response.content });
      const toolResults: AnthropicToolResultBlock[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const result = await executeAgentTool(block.name, block.input, ctx);
        toolSteps.push({ tool: block.name, label: describeToolCall(block.name, block.input) });
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      loopMessages.push({ role: "user", content: toolResults });
      continue;
    }

    // max_tokens or an unexpected stop — take whatever text we have.
    finalAnswer = response.content.find((c) => c.type === "text")?.text ?? "";
    break;
  }

  if (!finalAnswer) {
    finalAnswer =
      iteration >= MAX_ITERATIONS
        ? "Reached maximum reasoning steps without a complete response. Please try again."
        : "I read your photo but couldn't form a reply. Please try again.";
  }

  return { ok: true, answer: finalAnswer, toolSteps };
}
