// classify.ts — sort each extracted lead into a fit bucket with a cheap Haiku call.
//
// Same shape as the YouTube ingester's bucket classifier (lib/youtube/classify.ts): one cheap Haiku
// call returns a single word, parsed against the known set, degrading to "needs_research" on no-key /
// API error / unparseable output — never throws. The buckets answer "how warm is this lead for ME?",
// judged against the owner's own extraction pattern (which encodes who they're looking for), not a
// generic notion of quality.

import type { ExtractedProfile } from "./extract";
import { LEAD_CLASSIFICATIONS, type LeadClassification } from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLASSIFY_MODEL = "claude-haiku-4-5-20251001"; // cheap — a 1-word bucket pick

function isClassification(value: string): value is LeadClassification {
  return (LEAD_CLASSIFICATIONS as readonly string[]).includes(value);
}

const CLASSIFY_PROMPT = `You sort one extracted business lead into ONE fit bucket for a small-business owner. The owner described who they're looking for (their "extraction pattern"). Judge fit against THAT, not generic quality. Reply with EXACTLY one word, nothing else:

- hot — a strong fit who looks ready / high-intent for what the owner offers
- warm — a plausible fit worth a personalized reach-out, not obviously ready yet
- cold — a real business but a weak/long-shot fit
- wrong_fit — clearly not who the owner is looking for (wrong industry, competitor, not a business)
- needs_research — too little was extracted to judge; a human should look

Answer with one word from: hot, warm, cold, wrong_fit, needs_research.`;

type AnthropicResponse = { content?: Array<{ type: string; text?: string }> };

/**
 * Pick the fit bucket for one lead. Degrades to "needs_research" on no-key / API error / unparseable
 * output, which is the honest default — "we couldn't judge, look yourself" — never a silent crash.
 */
export async function classifyLead(params: {
  apiKey: string | null;
  extractionPattern: string;
  profile: ExtractedProfile;
}): Promise<LeadClassification> {
  if (!params.apiKey) return "needs_research";

  const fields = Object.entries(params.profile.fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const input = [
    `Owner is looking for: ${params.extractionPattern}`,
    `Lead name: ${params.profile.name || "(none found)"}`,
    `What they do: ${params.profile.summary || "(none found)"}`,
    `Contact: ${params.profile.contact || "(none found)"}`,
    fields ? `Extracted:\n${fields}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": params.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLASSIFY_MODEL,
        max_tokens: 8,
        messages: [{ role: "user", content: `${CLASSIFY_PROMPT}\n\n${input}` }],
      }),
      cache: "no-store",
    });
  } catch {
    return "needs_research"; // best-effort; a network blip means "look yourself", not a crash
  }
  if (!res.ok) return "needs_research";

  const data = (await res.json()) as AnthropicResponse;
  const word = (data.content?.find((c) => c.type === "text")?.text ?? "")
    .toLowerCase()
    .replace(/[^a-z_]/g, "");
  return isClassification(word) ? word : "needs_research";
}
