// generate-copy.ts — voice-aware landing page copy generation (PA-LPB-3). Wraps the same brain-voice
// flow the Email Drafter uses (buildMemoryBlocks → the owner's voice + business context) and produces
// one copy string per template section, keyed by section key: Record<sectionKey, string>.
//
// The model is asked for a single JSON object (one key per section) so coverage is checkable and a
// missing section degrades to a labeled placeholder rather than a blank block — never a silent gap.
// Every call meters one pa_cost_events row via the optional CostContext (backend anthropic).

import { type MemoryBlock } from "@/lib/pa-brain";
import { buildScopedMemoryBlocks } from "./scope";
import { logCostFromUsage, type CostContext } from "@/lib/cost/log";
import { sectionKeys } from "./templates";
import type { GeneratedCopy, LandingTemplate } from "./types";

const COPY_MODEL = "claude-sonnet-4-6";

type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicApiResponse = {
  content: AnthropicTextBlock[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

function formatBlocks(blocks: MemoryBlock[]): string {
  return blocks
    .map(({ path, content }) => {
      const numbered = content
        .split("\n")
        .map((l, i) => `${i + 1}: ${l}`)
        .join("\n");
      return `--- ${path} ---\n${numbered}`;
    })
    .join("\n\n");
}

function buildSystemPrompt(
  template: LandingTemplate,
  description: string,
  memoryBlocks: MemoryBlock[],
): string {
  const hasMemory = memoryBlocks.length > 0;
  const memorySection = hasMemory
    ? `BRAIN MEMORY FILES (the owner's business context, voice, services, pricing, proof):\n${formatBlocks(memoryBlocks)}\n\n`
    : `NOTE: No brain memory files are connected yet. Write the best copy you can from the description. Keep it honest — invent no prices, stats, testimonials, or credentials.\n\n`;

  const sectionSpec = template.sections
    .map((s) => `"${s.key}" — ${s.label}. ${template.defaultCopyPrompts[s.key]}`)
    .join("\n");

  return `You are writing the copy for a landing page on behalf of an independent business owner. Your job is to write it in THEIR voice — the way they'd say it — not like a marketing agency or ChatGPT. Read the brain's voice or communication notes carefully and match them.

${memorySection}WHAT THE OWNER WANTS THIS PAGE TO DO:
${description}

TEMPLATE: ${template.label} — ${template.description}

WRITE COPY FOR EACH SECTION BELOW. Each section's value is ONE string. Convention: the FIRST line is the section's headline; the lines after it are the body. A line that begins with "- " is a bullet point. Keep it tight — a landing page earns attention line by line.

SECTIONS:
${sectionSpec}

VOICE RULES (apply strictly):
- Write in the owner's voice from the brain. If there's no voice spec, default to short, direct, specific sentences — no padding.
- No hype words: no "unlock", "leverage", "seamless", "supercharge", "elevate", "revolutionary", "game-changing".
- No three-adjective stacks. No "in today's fast-paced world". No fake urgency.
- Never invent prices, numbers, testimonials, guarantees, or credentials. If the brain doesn't have it, don't claim it.
- Specific beats vague every time. Use real details from the brain where they fit.

OUTPUT FORMAT (this exactly, nothing else):
A single JSON object. One key per section id above. Each value is the section's copy string (use \\n for line breaks). No preamble, no markdown fences, no commentary — just the JSON object.`;
}

/** Strip an accidental ```json fence and parse. Returns null on any failure (caller fills the gap). */
function parseCopyObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** A labeled, honest fallback for a section the model didn't return, so a page is never half-blank. */
function fallbackFor(template: LandingTemplate, key: string): string {
  const section = template.sections.find((s) => s.key === key);
  const label = section?.label ?? key;
  return `${label}\nAdd the copy for this section — the agent left it for you to fill in.`;
}

/**
 * Generate the copy for a landing page in the owner's voice. Returns one string per section key. The
 * `cost` context (when supplied) meters the Anthropic call to the cost ledger. Throws only on a hard
 * Anthropic transport error — a malformed or partial model response degrades to per-section fallbacks.
 *
 * `scope` is the brain_scope from the page row (PA-LPB-7). Null/undefined → the owner's personal
 * brain (existing behaviour). A path → scoped loader via buildScopedMemoryBlocks.
 */
export async function generateLandingCopy(
  params: {
    template: LandingTemplate;
    description: string;
    /** Repo-relative scope path from the page row; null/undefined = owner brain root. */
    scope?: string | null;
  },
  anthropicApiKey: string,
  brainRepo: string | null,
  githubToken: string | null,
  cost?: CostContext,
): Promise<{ copy: GeneratedCopy; hasBrain: boolean }> {
  const memoryBlocks: MemoryBlock[] = brainRepo
    ? await buildScopedMemoryBlocks(brainRepo, githubToken, params.scope)
    : [];

  const systemPrompt = buildSystemPrompt(params.template, params.description, memoryBlocks);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: COPY_MODEL,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: "Write the landing page copy now. Output only the JSON object — one key per section.",
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic error: ${await res.text()}`);
  }

  const msg = (await res.json()) as AnthropicApiResponse;
  if (cost) {
    await logCostFromUsage(cost, "anthropic", COPY_MODEL, {
      tokensInput: msg.usage?.input_tokens ?? 0,
      tokensOutput: msg.usage?.output_tokens ?? 0,
    });
  }

  const text = msg.content.find((c) => c.type === "text")?.text ?? "";
  const parsed = parseCopyObject(text);

  // Build the copy covering every section key — model value when present + non-empty, else a labeled
  // fallback so the assembled page never carries an empty section.
  const copy: GeneratedCopy = {};
  for (const key of sectionKeys(params.template)) {
    const value = parsed?.[key];
    copy[key] =
      typeof value === "string" && value.trim() ? value.trim() : fallbackFor(params.template, key);
  }

  return { copy, hasBrain: memoryBlocks.length > 0 };
}
