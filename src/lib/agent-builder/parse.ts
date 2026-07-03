// parse.ts — the Agent Builder's ONE model call (§19 step 1): turn the owner's plain-English
// spec into a Zod-validated ParsedIntent. Everything downstream (persona / toolkit / skills /
// brain scopes) composes DETERMINISTICALLY from this structure — one call, predictable cost,
// and the composed agent can only ever be assembled from shipped PA primitives because the
// intent's fields are enums over those primitives.
//
// Rides the BYO LLM dispatcher (completeLlm) like every other PA agent call — PA-managed
// Claude Sonnet by default, the owner's own provider when configured. Every call writes one
// pa_cost_events row (featureSlug 'agent_builder', deterministic idempotency key).

import { completeLlm, type DispatchCompletionResult, type DispatchParams } from "@/lib/llm/dispatch";
import { logCostFromUsage } from "@/lib/cost/log";
import type { CostBackend } from "@/lib/cost/prices";
import type { LlmProvider } from "@/lib/llm/types";
import {
  AGENT_CAPABILITIES,
  AGENT_ROLES,
  BRAIN_SCOPES,
  ParsedIntentSchema,
  type ParsedIntent,
} from "./types";
import { agentBuilderLog } from "./log";

const SYSTEM = [
  "You turn a small-business owner's plain-English description of an agent they need into a",
  "strict JSON intent. You are a COMPOSER's front end: every field must come from the allowed",
  "lists below. Never invent capabilities outside the lists. Never output code.",
  "",
  `Allowed roles: ${AGENT_ROLES.join(", ")}.`,
  `Allowed capabilities: ${AGENT_CAPABILITIES.join(", ")}.`,
  `Allowed brainZones: ${BRAIN_SCOPES.join(", ")}.`,
  "",
  "Field rules:",
  '- summary: one line restating the job. jobNoun: a 2-4 word noun phrase naming the job (e.g. "Adjuster Follow-Up").',
  "- role: the closest role. watches: what it monitors (empty string if on-demand). does: what it produces.",
  '- voice: "owner" when output is written as the owner (emails, posts, proposals), else "neutral".',
  '- schedule: the plain-English recurrence if the spec names one ("every Monday 8am"), else null.',
  "- brainZones: only the zones the job truly needs to read.",
  "- capabilities: 1-8 entries from the allowed list.",
  "- neededTechniques: up to 5 short technique names the agent needs (e.g. \"quote follow-up\", \"objection handling\").",
  "",
  "Reply with ONE JSON object only. No prose, no markdown fences.",
].join("\n");

export class AgentSpecParseError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AgentSpecParseError";
    this.status = status;
  }
}

// The dispatcher can resolve to a BYO provider; map it onto the cost ledger's backend vocabulary.
function backendFor(provider: LlmProvider): CostBackend {
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

// Pull the first {...} block out of the model text — tolerant of stray prose around the JSON.
function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

export type ParseDeps = {
  complete: (params: DispatchParams) => Promise<DispatchCompletionResult>;
  logCost: typeof logCostFromUsage;
};

const defaultDeps: ParseDeps = { complete: completeLlm, logCost: logCostFromUsage };

/**
 * Parses the owner's spec into a ParsedIntent. Throws AgentSpecParseError on a provider
 * failure or an output that doesn't validate — the route maps it to a clean 4xx/5xx.
 */
export async function parseAgentSpec(
  params: {
    ownerId: string;
    buildId: string;
    specText: string;
    paManagedKey: string;
  },
  deps: ParseDeps = defaultDeps,
): Promise<ParsedIntent> {
  const res = await deps.complete({
    userId: params.ownerId,
    paManagedKey: params.paManagedKey,
    system: SYSTEM,
    messages: [{ role: "user", content: params.specText }],
    maxTokens: 1_000,
  });

  if (!res.ok) {
    agentBuilderLog.error("spec parse call failed", {
      ownerId: params.ownerId,
      buildId: params.buildId,
      status: res.status,
      error: res.error,
    });
    throw new AgentSpecParseError(
      "The model behind the Agent Builder is unavailable. Try again.",
      502,
    );
  }

  // Ledger the realized cost — one row per parse, idempotent on the build id so a route retry
  // never double-counts (PA-POS-27 rides the PA-POS-30 allowance via this ledger).
  await deps.logCost(
    {
      ownerId: params.ownerId,
      featureSlug: "agent_builder",
      idempotencyKey: `agent_builder:parse:${params.buildId}`,
    },
    backendFor(res.provider),
    res.model,
    { tokensInput: res.inputTokens, tokensOutput: res.outputTokens },
  );

  const raw = extractJsonObject(res.text);
  if (raw === null) {
    agentBuilderLog.warn("spec parse returned non-JSON", {
      ownerId: params.ownerId,
      buildId: params.buildId,
    });
    throw new AgentSpecParseError(
      "Couldn't read that spec. Add a sentence about what the agent should watch and what it should produce, then try again.",
      422,
    );
  }

  const parsed = ParsedIntentSchema.safeParse(raw);
  if (!parsed.success) {
    agentBuilderLog.warn("spec parse failed intent validation", {
      ownerId: params.ownerId,
      buildId: params.buildId,
      issue: parsed.error.issues[0]?.message ?? "unknown",
    });
    throw new AgentSpecParseError(
      "Couldn't map that spec onto the agent parts Pocket Agent ships. Describe the job in a sentence or two — what it watches, what it produces.",
      422,
    );
  }

  return parsed.data;
}

// Exported for the parse unit tests (round-trip the 5 example specs against a mock model).
export const AGENT_SPEC_PARSE_SYSTEM = SYSTEM;
export const parseInternals = { extractJsonObject, backendFor };
