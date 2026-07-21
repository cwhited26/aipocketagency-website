// llm.ts — the metered Anthropic call LinkedIn Scout's research + drafting share.
//
// One place the brief writer and the draft generator go through, so the model, the cost-metering, and
// the response parsing live in a single spot. The completion is injectable (CompleteFn) so draft.ts's
// two-strike voice retry and brief.ts unit-test without a network — the default impl calls Anthropic
// directly (mirrors lib/pa-drafts.ts) and writes one pa_cost_events row per call via logCostFromUsage.

import { logCostFromUsage, type CostContext } from "@/lib/cost/log";

/** Sonnet 4.6 — the same drafting model the Email Drafter + Lead Scout outreach use (pa-drafts.ts). */
export const LINKEDIN_SCOUT_MODEL = "claude-sonnet-4-6";

export type CompleteArgs = {
  system: string;
  user: string;
  maxTokens: number;
  /** Cost context — who's paying, the feature sub-slug, and a deterministic idempotency key (SPEC §7). */
  cost: CostContext;
};

/** Returns the model's text, or an error — never throws, so the caller can degrade/retry cleanly. */
export type CompleteFn = (args: CompleteArgs) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

/** The default completion: PA-managed Anthropic keyed by the owner's stored key, cost-metered. */
export function defaultComplete(anthropicApiKey: string): CompleteFn {
  return async ({ system, user, maxTokens, cost }) => {
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: LINKEDIN_SCOUT_MODEL,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        }),
        cache: "no-store",
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "network error" };
    }
    if (!res.ok) {
      return { ok: false, error: `Anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` };
    }
    const msg = (await res.json().catch(() => null)) as AnthropicResponse | null;
    await logCostFromUsage(cost, "anthropic", LINKEDIN_SCOUT_MODEL, {
      tokensInput: msg?.usage?.input_tokens ?? 0,
      tokensOutput: msg?.usage?.output_tokens ?? 0,
    });
    const text = msg?.content?.find((c) => c.type === "text")?.text ?? "";
    return { ok: true, text };
  };
}
