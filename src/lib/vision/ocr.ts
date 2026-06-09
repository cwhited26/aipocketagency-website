// ocr.ts — Claude vision OCR for chat image uploads. Direct REST to the Anthropic Messages
// API (no SDK — repo rule), the same transport absorb.ts uses. Given an uploaded image (or PDF)
// it returns the text Claude reads out of the picture, a plain-English description of what the
// image shows, and Claude's own confidence — so the Ask box agent can "see" a screenshot the
// owner drops in (e.g. a Facebook post of an Excel sheet) and answer about it.
//
// Public API:
//   isVisionUploadType / canOcrType / visionTypeLabel — type gating for the Ask box
//   runVisionOcr(...)   — POST the bytes to Claude vision, return { text, structured_description, confidence }
//   estimateOcrCostUsd  — token usage → USD at the model's published rate
//   buildOcrContextBlock — fold the OCR result into the user turn the agent reads

// The house model — matches lib/llm/types.ts PA_MANAGED_MODEL and the rest of the repo. The task
// brief named claude-sonnet-4-5-20250929; verified against the codebase + current model lineup —
// 4.6 is the current Sonnet, so we use the house string rather than a stale pin.
import { logCostFromUsage, type CostContext } from "@/lib/cost/log";

export const VISION_MODEL = "claude-sonnet-4-6";

// Published Sonnet rates (USD per million tokens). Used to stamp pa_vision_log.cost_usd.
const INPUT_USD_PER_MTOK = 3;
const OUTPUT_USD_PER_MTOK = 15;

// ─── Type gating ───────────────────────────────────────────────────────────────────
// Types Claude vision can read directly: images go in an image block, PDFs in a document block.
const OCR_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const OCR_DOC_TYPES = new Set(["application/pdf"]);
// Accepted for upload (stored, thumbnailed) but NOT readable by Claude — stored, OCR skipped.
const STORE_ONLY_TYPES = new Set(["image/heic", "image/heif"]);

const VISION_TYPE_LABELS: Record<string, string> = {
  "image/png": "PNG image",
  "image/jpeg": "JPEG image",
  "image/webp": "WebP image",
  "image/gif": "GIF image",
  "image/heic": "HEIC image",
  "image/heif": "HEIF image",
  "application/pdf": "PDF",
};

/** True when the type is accepted on the Ask box (PNG/JPG/WEBP/HEIC/GIF/PDF). */
export function isVisionUploadType(mimeType: string): boolean {
  return OCR_IMAGE_TYPES.has(mimeType) || OCR_DOC_TYPES.has(mimeType) || STORE_ONLY_TYPES.has(mimeType);
}

/** True when Claude vision can actually read the type (image or PDF — not HEIC). */
export function canOcrType(mimeType: string): boolean {
  return OCR_IMAGE_TYPES.has(mimeType) || OCR_DOC_TYPES.has(mimeType);
}

/** Human-friendly label for a mime type, falling back to the raw type. */
export function visionTypeLabel(mimeType: string): string {
  return VISION_TYPE_LABELS[mimeType] ?? mimeType;
}

/** USD cost of one OCR call at the model's published per-token rate. */
export function estimateOcrCostUsd(promptTokens: number, completionTokens: number): number {
  const usd =
    (promptTokens / 1_000_000) * INPUT_USD_PER_MTOK +
    (completionTokens / 1_000_000) * OUTPUT_USD_PER_MTOK;
  // Round to the 4 decimals pa_vision_log.cost_usd stores.
  return Math.round(usd * 10_000) / 10_000;
}

// ─── OCR call ──────────────────────────────────────────────────────────────────────

const OCR_PROMPT = `You are reading an image or document a business owner just uploaded to their AI agent so the agent can act on it.

Return ONLY valid JSON in this exact shape — no markdown fence, no prose, just the object:
{
  "text": "every piece of readable text in the image, verbatim, preserving rows/columns/line structure as plain text (use tabs or pipes for table cells). Empty string if there is genuinely no text.",
  "structured_description": "1-3 sentences in plain English describing what this image is and what it shows (e.g. a screenshot of a Facebook post containing a spreadsheet of vendor prices).",
  "confidence": 0.0
}

confidence is YOUR honest 0.0-1.0 self-assessment of how completely and accurately you extracted the text (1.0 = crisp and fully captured, lower for blur, glare, handwriting, or cut-off content).`;

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

/** Builds the Claude content blocks for a given upload type. Pure — unit-testable. */
export function buildOcrContent(mimeType: string, base64: string): ContentBlock[] | null {
  if (OCR_DOC_TYPES.has(mimeType)) {
    return [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
      { type: "text", text: OCR_PROMPT },
    ];
  }
  if (OCR_IMAGE_TYPES.has(mimeType)) {
    return [
      { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
      { type: "text", text: OCR_PROMPT },
    ];
  }
  return null;
}

export type VisionOcrResult =
  | {
      ok: true;
      text: string;
      structured_description: string;
      confidence: number;
      promptTokens: number;
      completionTokens: number;
    }
  | { ok: false; error: string };

type AnthropicResponse = {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/**
 * Reads an uploaded image/PDF with Claude vision and returns the extracted text, a plain-English
 * description, and a confidence score. Never throws on an API/timeout/parse error — it returns
 * { ok:false } so the caller can store the file and degrade gracefully (no silent catch).
 */
export async function runVisionOcr(params: {
  apiKey: string;
  mimeType: string;
  buffer: Buffer;
  /** Network abort, ms. Vision on a large screenshot can be slow; default 60s. */
  timeoutMs?: number;
  /** When set, one anthropic (Sonnet) cost event is logged for this OCR call. */
  cost?: CostContext;
}): Promise<VisionOcrResult> {
  const content = buildOcrContent(params.mimeType, params.buffer.toString("base64"));
  if (!content) {
    return { ok: false, error: `${visionTypeLabel(params.mimeType)} can't be read by vision.` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 60_000);

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": params.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content }],
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error && e.name === "AbortError" ? "Vision read timed out." : "Vision request failed.",
    };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    if (res.status === 401) return { ok: false, error: "Invalid Anthropic API key." };
    if (res.status === 429) return { ok: false, error: "Anthropic rate limit hit. Try again in a moment." };
    return { ok: false, error: `Vision API error (${res.status}): ${errText.slice(0, 120)}` };
  }

  const data = (await res.json()) as AnthropicResponse;
  const promptTokens = data.usage?.input_tokens ?? 0;
  const completionTokens = data.usage?.output_tokens ?? 0;
  if (params.cost) {
    await logCostFromUsage(params.cost, "anthropic", VISION_MODEL, {
      tokensInput: promptTokens,
      tokensOutput: completionTokens,
    });
  }
  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { ok: false, error: "Vision returned an unexpected format." };

  let parsed: { text?: string; structured_description?: string; confidence?: number };
  try {
    parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
  } catch {
    return { ok: false, error: "Could not parse the vision response." };
  }

  const confidence = typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0;
  return {
    ok: true,
    text: (parsed.text ?? "").trim(),
    structured_description: (parsed.structured_description ?? "").trim(),
    confidence,
    promptTokens,
    completionTokens,
  };
}

/**
 * Folds an OCR result into the plain-text block the agent reads as part of the user's turn. This
 * is how the agent "sees" the upload: the screenshot's text + a description ride inside the message
 * `content`, so the existing tool-use loop carries it through history with zero new plumbing.
 */
export function buildOcrContextBlock(
  fileName: string,
  ocr: { text: string; structured_description: string } | null,
): string {
  if (!ocr) {
    return `[Attached image: ${fileName} — its text could not be read automatically.]`;
  }
  const lines = [`[Attached image: ${fileName}]`];
  if (ocr.structured_description) lines.push(`What the image shows: ${ocr.structured_description}`);
  if (ocr.text) lines.push(`Text extracted from the image:\n${ocr.text}`);
  else lines.push("No readable text was found in the image.");
  return lines.join("\n");
}
