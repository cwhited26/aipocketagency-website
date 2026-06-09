// extract.ts — turn a fetched page's HTML into a structured lead profile with Claude Sonnet.
//
// The extraction is pattern-driven: the owner's plain-English extraction pattern ("name, owner,
// phone, what they do, whether they look like a fit for roofing supplements") becomes the spec
// Claude pulls against. We strip the HTML down to visible text first (scripts/styles gone, tags
// collapsed) so the model spends its tokens on content, not markup, and cap it so a giant page can't
// blow the context. Direct REST, typed result, no silent catch — a failure returns { ok:false } and
// the lead is recorded as failed rather than crashing the batch.

import { logCostFromUsage, type CostContext } from "@/lib/cost/log";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const EXTRACT_MODEL = "claude-sonnet-4-6";
const MAX_TEXT_CHARS = 30_000;

export type ExtractedProfile = {
  /** Best business / person name found, "" if none. */
  name: string;
  /** Best contact handle found (email / phone / contact-page note), "" if none. */
  contact: string;
  /** One-paragraph plain-English summary of what they do. */
  summary: string;
  /** Everything the extraction pattern asked for, as key→value. Always present (may be empty). */
  fields: Record<string, string>;
};

export type ExtractResult =
  | { ok: true; profile: ExtractedProfile; promptTokens: number; completionTokens: number }
  | { ok: false; status: number; error: string };

/** Reduce raw HTML to visible text: drop script/style/noscript, strip tags, collapse whitespace. */
export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, MAX_TEXT_CHARS);
}

function buildPrompt(extractionPattern: string, url: string): string {
  return `You extract a structured lead profile from a web page for a small-business owner's AI agent.

The owner described what to pull out (the "extraction pattern"). Follow it. Pull only what's actually on the page — never invent a name, phone, or email that isn't there; leave a field empty instead.

Extraction pattern (what to extract):
${extractionPattern}

Return ONLY valid JSON in this exact shape — no markdown, no prose:
{
  "name": "the business or person name, or empty string",
  "contact": "the single best contact (email or phone or contact-page note), or empty string",
  "summary": "one plain-English sentence on what they do",
  "fields": { "<each thing the pattern asked for>": "<value found, or empty string>" }
}

Page URL: ${url}`;
}

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

function coerceFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
  }
  return out;
}

/** Run the extraction. `apiKey` is the owner's Anthropic key (their key, their bill). */
export async function extractProfile(params: {
  apiKey: string;
  html: string;
  extractionPattern: string;
  url: string;
  /** When set, one anthropic cost event is logged for this extraction. */
  cost?: CostContext;
}): Promise<ExtractResult> {
  const text = htmlToText(params.html);
  if (!text) return { ok: false, status: 422, error: "Page had no readable text to extract from." };

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
        model: EXTRACT_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `${buildPrompt(params.extractionPattern, params.url)}\n\n--- PAGE TEXT ---\n${text}`,
          },
        ],
      }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, error: "Couldn't reach Claude to extract the profile." };
  }

  if (!res.ok) {
    if (res.status === 401) return { ok: false, status: 401, error: "Invalid Anthropic API key." };
    if (res.status === 429) return { ok: false, status: 429, error: "Anthropic rate limit hit." };
    return { ok: false, status: res.status, error: `Claude extraction failed (${res.status}).` };
  }

  const data = (await res.json()) as AnthropicResponse;
  const promptTokens = data.usage?.input_tokens ?? 0;
  const completionTokens = data.usage?.output_tokens ?? 0;
  if (params.cost) {
    await logCostFromUsage(params.cost, "anthropic", EXTRACT_MODEL, {
      tokensInput: promptTokens,
      tokensOutput: completionTokens,
    });
  }
  const raw = data.content?.find((c) => c.type === "text")?.text ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { ok: false, status: 502, error: "Claude returned an unexpected format." };

  let parsed: { name?: unknown; contact?: unknown; summary?: unknown; fields?: unknown };
  try {
    parsed = JSON.parse(match[0]) as typeof parsed;
  } catch {
    return { ok: false, status: 502, error: "Couldn't parse Claude's extraction." };
  }

  return {
    ok: true,
    profile: {
      name: typeof parsed.name === "string" ? parsed.name.trim() : "",
      contact: typeof parsed.contact === "string" ? parsed.contact.trim() : "",
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
      fields: coerceFields(parsed.fields),
    },
    promptTokens,
    completionTokens,
  };
}
