// run.ts — the debate execution seam. Each agent turn is one explicit-target LLM call (PA-DR-3 model
// diversity) grounded in the owner's brain context, metered through the cost ledger (featureSlug
// 'roundtable', PA-COST). The /advance route owns the DB reads/writes and round loop; this module turns
// a (role, target, transcript) into a turn's text, and the Moderator's into a parsed verdict. Brain
// reads ride the existing memory loader + ContainmentGuard — no new infrastructure (PA-DR principle 3).

import { completeLlmWithTarget } from "@/lib/llm/dispatch";
import type { LlmProvider } from "@/lib/llm/types";
import { logCostFromUsage, type CostContext } from "@/lib/cost/log";
import type { CostBackend } from "@/lib/cost/prices";
import { buildMemoryBlocks, formatMemoryBlocksForPrompt } from "@/lib/pa-brain";
import { loadZoneConfig, partitionReadablePaths } from "@/lib/brain/containment-guard";
import {
  buildArgSystemPrompt,
  buildArgUserPrompt,
  buildModeratorSystemPrompt,
  buildModeratorUserPrompt,
  parseVerdict,
} from "./roles";
import { backingLabel, type ProviderTarget } from "./providers";
import type { ArguingRole, Verdict } from "./types";

// Cap the brain context fed to each agent so a large brain doesn't blow the prompt budget across the
// 3-4 agents × N rounds the debate runs.
const MAX_BRAIN_CONTEXT_CHARS = 12_000;
const ARG_MAX_TOKENS = 800;
const MODERATOR_MAX_TOKENS = 1_000;

/** Map a dispatcher provider to a cost-ledger backend. OpenAI-compatible BYO providers (grok/groq/
 *  custom) ride the "openai" backend; unknown models price to 0 in the ledger (an internal warn), which
 *  is correct — the owner's BYO key bears that spend directly, outside PA's ledger. */
export function costBackendFor(provider: LlmProvider): CostBackend {
  switch (provider) {
    case "openai":
    case "groq":
    case "grok":
    case "custom_openai_compatible":
      return "openai";
    case "anthropic":
    case "pa_managed":
      return "anthropic";
  }
}

/**
 * Loads the owner's brain into a single context string for the agents, filtered through the
 * ContainmentGuard so user-private zones never enter the debate transcript (PA-DR §11 exfiltration
 * defense rides the same RLS + zone config chat uses). Returns "" when no brain is connected or the read
 * fails — the agents then argue from the general case and say so.
 */
export async function buildBrainContext(repo: string | null, token: string | null): Promise<string> {
  if (!repo) return "";
  try {
    const { config } = await loadZoneConfig(repo, token);
    const blocks = await buildMemoryBlocks(
      repo,
      token,
      (paths) => partitionReadablePaths(paths, config, "agent-read").allowed,
    );
    if (blocks.length === 0) return "";
    const formatted = formatMemoryBlocksForPrompt(blocks);
    return formatted.length > MAX_BRAIN_CONTEXT_CHARS
      ? formatted.slice(0, MAX_BRAIN_CONTEXT_CHARS) + "\n…(brain context truncated)"
      : formatted;
  } catch {
    return "";
  }
}

// ── Single agent turn ───────────────────────────────────────────────────────────────────────

type RunAgentResult = { content: string; backing: string };

async function runAgent(
  primary: ProviderTarget,
  fallback: ProviderTarget,
  system: string,
  userContent: string,
  maxTokens: number,
  ownerId: string,
  idempotencyKey: string,
  conversationId: string | null,
): Promise<RunAgentResult> {
  const cost: CostContext = {
    ownerId,
    featureSlug: "roundtable",
    idempotencyKey,
    ...(conversationId ? { conversationId } : {}),
  };

  let target = primary;
  let res = await completeLlmWithTarget(target, { system, messages: [{ role: "user", content: userContent }], maxTokens });
  // A failed BYO target retries once on the PA-managed fallback so one bad key never wedges a debate.
  if (!res.ok && (fallback.provider !== primary.provider || fallback.model !== primary.model)) {
    target = fallback;
    res = await completeLlmWithTarget(target, { system, messages: [{ role: "user", content: userContent }], maxTokens });
  }
  if (!res.ok) {
    throw new Error(`Agent turn failed (${res.status}): ${res.error}`);
  }
  await logCostFromUsage(cost, costBackendFor(res.provider), res.model, {
    tokensInput: res.inputTokens,
    tokensOutput: res.outputTokens,
  });
  return { content: res.text.trim(), backing: backingLabel(target) };
}

// ── Public turn runners (called per role by the /advance route) ──────────────────────────────

export type ArgTurnInput = {
  role: ArguingRole;
  target: ProviderTarget;
  fallback: ProviderTarget;
  question: string;
  brainContext: string;
  transcript: string;
  interjection: string | null;
  vertical: string | null;
  roundIndex: number;
  ownerId: string;
  roundtableId: string;
  conversationId: string | null;
};

export async function runArgumentTurn(input: ArgTurnInput): Promise<RunAgentResult> {
  const system = buildArgSystemPrompt(input.role, input.vertical);
  const user = buildArgUserPrompt({
    question: input.question,
    brainContext: input.brainContext,
    transcript: input.transcript,
    interjection: input.interjection,
    vertical: input.vertical,
  });
  return runAgent(
    input.target,
    input.fallback,
    system,
    user,
    ARG_MAX_TOKENS,
    input.ownerId,
    `${input.roundtableId}:r${input.roundIndex}:${input.role}`,
    input.conversationId,
  );
}

export type ModeratorTurnInput = {
  target: ProviderTarget;
  fallback: ProviderTarget;
  question: string;
  brainContext: string;
  transcript: string;
  ownerId: string;
  roundtableId: string;
  conversationId: string | null;
};

export async function runModeratorTurn(
  input: ModeratorTurnInput,
): Promise<RunAgentResult & { verdict: Verdict }> {
  const system = buildModeratorSystemPrompt();
  const user = buildModeratorUserPrompt({
    question: input.question,
    brainContext: input.brainContext,
    transcript: input.transcript,
  });
  const res = await runAgent(
    input.target,
    input.fallback,
    system,
    user,
    MODERATOR_MAX_TOKENS,
    input.ownerId,
    `${input.roundtableId}:moderator`,
    input.conversationId,
  );
  return { ...res, verdict: parseVerdict(res.content) };
}
