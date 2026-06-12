// summary.ts — the Inspector's ONE metered LLM call. Input is the Design DNA record and the role
// hierarchy it carries (section archetypes, heading-size ladder, behavior list) — NEVER the
// target's literal copy; the DNA schema has no copy fields, so the model physically can't see any
// (PA-DNA-7, the Lane C rule). Output is the offer read + the profile's prose body. Degrades to a
// deterministic structural summary on no-key / API error — a capture never fails on the model.

import { logCostFromUsage, type CostContext } from "@/lib/cost/log";
import { serializeDesignDna } from "@/lib/url-extraction/serialize";
import type { DesignDna, SourceMeta } from "@/lib/url-extraction/types";
import type { ProfileProse } from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const SUMMARY_MODEL = "claude-sonnet-4-6";

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

const PROMPT = `You're reading a structured style record extracted from a business website. The record contains ONLY computed visual data — colors, type sizes, layout archetypes, observed behaviors. It contains none of the site's text, and you must not invent any.

Write four things for the owner of a small business who captured this competitor:

1. "offer_summary" — one or two sentences on what this company appears to sell and how the page sells it, judged ONLY from structure (a pricing-columns section means tiered plans; a logo marquee means social proof; heavy product frames mean a software demo). Use "appears to" framing — you are reading structure, not copy.
2. "look_paragraph" — the look in one paragraph: palette, type, spacing, motion. Plain English. Specific.
3. "distinctive" — 2 to 4 bullets on what's genuinely distinctive in this record (an odd radius pairing, off-standard font weights, a one-accent palette). Skip generic observations.
4. "borrow_skip" — 2 or 3 sentences: what's worth borrowing for the owner's own site, what to skip and why.

Write like one owner talking to another. Short sentences. No marketing-speak — never "sleek", "modern and clean", "elevate", "seamless", "cutting-edge", "leverage". No hedging filler. Say the specific thing the data shows.

Reply with ONLY a JSON object: {"offer_summary": "...", "look_paragraph": "...", "distinctive": ["...", "..."], "borrow_skip": "..."}`;

/** The deterministic fallback — structural facts only, honest about the model not running. */
export function structuralFallbackProse(dna: DesignDna, reason: string): ProfileProse {
  const archetypes = dna.layout.map((l) => l.archetype);
  const offerHints: string[] = [];
  if (archetypes.includes("pricing-columns")) offerHints.push("a pricing section with plan columns (sells tiered plans)");
  if (archetypes.includes("logo-marquee")) offerHints.push("a customer-logo strip (leans on social proof)");
  if (archetypes.some((a) => a === "bento-grid" || a === "card-grid")) offerHints.push("a feature grid (sells on capabilities)");
  const offer =
    offerHints.length > 0
      ? `Structural read only (${reason}): the page carries ${offerHints.join(", ")}.`
      : `Structural read only (${reason}): no pricing or proof sections detected — the page reads as a single-message pitch.`;

  const paletteRoles = Object.keys(dna.palette.roles).length;
  const scale = dna.typography.scale;
  const look = `${dna.palette.mode === "dark" ? "Dark" : "Light"} canvas, ${paletteRoles} palette roles recorded. Type runs ${
    scale.length > 0 ? `${scale[scale.length - 1].px}px body up to ${scale[0].px}px headlines` : "an unmeasured scale"
  }. ${dna.behaviors.length} behaviors observed; interaction model reads ${dna.interaction_model}.`;

  return {
    offer_summary: offer,
    look_paragraph: look,
    distinctive: [
      dna.spacing.base_unit_px ? `Spacing sits on a ${dna.spacing.base_unit_px}px grid` : "No consistent spacing grid detected",
      dna.radius.length > 0 ? `${dna.radius.length} distinct corner radii (${dna.radius.map((r) => `${r.px}px`).join(", ")})` : "No rounded corners recorded",
    ],
    borrow_skip: "No model read ran on this capture — review the frontmatter values directly before borrowing anything.",
  };
}

function parseProse(text: string): ProfileProse | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<ProfileProse>;
    if (
      typeof parsed.offer_summary !== "string" ||
      typeof parsed.look_paragraph !== "string" ||
      !Array.isArray(parsed.distinctive) ||
      typeof parsed.borrow_skip !== "string"
    ) {
      return null;
    }
    return {
      offer_summary: parsed.offer_summary,
      look_paragraph: parsed.look_paragraph,
      distinctive: parsed.distinctive.filter((d): d is string => typeof d === "string").slice(0, 4),
      borrow_skip: parsed.borrow_skip,
    };
  } catch {
    return null;
  }
}

/**
 * Generate the offer summary + profile prose from the DNA record alone. One Sonnet call, cost
 * logged against the owner; never throws — every failure path returns the structural fallback.
 */
export async function generateProfileProse(params: {
  apiKey: string | null;
  dna: DesignDna;
  source: SourceMeta;
  cost: CostContext;
}): Promise<ProfileProse> {
  if (!params.apiKey) return structuralFallbackProse(params.dna, "no model key connected");

  const input = [
    `Captured site title: ${params.source.title}`,
    `Captured URL: ${params.source.final_url}`,
    "",
    "The style record:",
    "```yaml",
    serializeDesignDna(params.dna),
    "```",
  ].join("\n");

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
        model: SUMMARY_MODEL,
        max_tokens: 900,
        messages: [{ role: "user", content: `${PROMPT}\n\n${input}` }],
      }),
      cache: "no-store",
    });
  } catch {
    return structuralFallbackProse(params.dna, "model call failed");
  }
  if (!res.ok) return structuralFallbackProse(params.dna, `model returned ${res.status}`);

  const data = (await res.json()) as AnthropicResponse;
  await logCostFromUsage(params.cost, "anthropic", SUMMARY_MODEL, {
    tokensInput: data.usage?.input_tokens ?? 0,
    tokensOutput: data.usage?.output_tokens ?? 0,
  });

  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  const prose = parseProse(text);
  return prose ?? structuralFallbackProse(params.dna, "model reply didn't parse");
}
