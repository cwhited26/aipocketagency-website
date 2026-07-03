// compose.ts — turn-1 agent composition for a cold sender (§22.2). Rides the SHIPPED Custom
// Agent Builder engine (PA-POS-27): the same parse call, the same deterministic persona /
// toolkit / skills composition — trimmed to a trial profile. No brain scopes and no candidate
// Skill: the trial thread has no repo to scope or push to until the owner converts.
//
// Cold senders have no PA account, so the parse call targets the platform Anthropic key
// directly (completeLlmWithTarget) instead of the per-owner BYO dispatcher, and token usage
// logs to the structured log instead of the per-owner pa_cost_events ledger.

import { completeLlmWithTarget } from "@/lib/llm/dispatch";
import { PA_MANAGED_MODEL } from "@/lib/llm/types";
import { AgentSpecParseError, parseAgentSpec } from "@/lib/agent-builder/parse";
import { composePersona } from "@/lib/agent-builder/compose-persona";
import { composeToolkit } from "@/lib/agent-builder/compose-toolkit";
import { composeSkills } from "@/lib/agent-builder/compose-skills";
import { coldLog } from "./log";
import { hashPhoneForLog } from "./phone";
import type { TrialComposed } from "./types";

export type TrialComposeResult =
  | { ok: true; composed: TrialComposed }
  // parse_miss: the message didn't describe a composable job (greetings, "hi") — not an error.
  | { ok: false; reason: "parse_miss" | "unavailable" };

export type TrialComposeDeps = {
  complete: typeof completeLlmWithTarget;
};

const defaultDeps: TrialComposeDeps = { complete: completeLlmWithTarget };

/** Composes the trimmed trial profile from the sender's message. One model call. */
export async function composeTrialAgent(
  params: { senderPhone: string; specText: string; anthropicKey: string },
  deps: TrialComposeDeps = defaultDeps,
): Promise<TrialComposeResult> {
  const sender = hashPhoneForLog(params.senderPhone);

  let intent;
  try {
    intent = await parseAgentSpec(
      {
        // parseAgentSpec wants an owner id for its cost ledger; the injected deps below bypass
        // both, so this is a log-correlation handle only — never a DB key.
        ownerId: `trial:${sender}`,
        buildId: `trial:${sender}`,
        specText: params.specText,
        paManagedKey: params.anthropicKey,
      },
      {
        complete: (p) =>
          deps.complete(
            { provider: "anthropic", model: PA_MANAGED_MODEL, apiKey: params.anthropicKey },
            { system: p.system, messages: p.messages, maxTokens: p.maxTokens },
          ),
        // No pa_cost_events row for a cold sender — ledger to the structured log instead.
        logCost: async (meta, backend, model, usage) => {
          coldLog.info("trial compose tokens", {
            sender,
            backend,
            model,
            tokensInput: usage.tokensInput,
            tokensOutput: usage.tokensOutput,
            feature: meta.featureSlug,
          });
        },
      },
    );
  } catch (e) {
    if (e instanceof AgentSpecParseError) {
      // 422 = the model answered but the message isn't a composable spec. 5xx = provider down.
      return { ok: false, reason: e.status === 422 ? "parse_miss" : "unavailable" };
    }
    throw e;
  }

  const persona = composePersona({ intent, existingNames: [] });
  const apps = composeToolkit(intent);
  const { skillSlugs } = composeSkills(intent);

  return {
    ok: true,
    composed: {
      specText: params.specText.slice(0, 4_000),
      intent,
      personaTemplateKey: persona.templateKey,
      personaName: persona.name,
      personaSlug: persona.slug,
      tone: persona.tone,
      starterPrompt: persona.starterPrompt,
      customFields: persona.customFields,
      apps,
      skillSlugs,
    },
  };
}
