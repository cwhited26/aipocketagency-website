// types.ts — shared, provider-agnostic types for the BYO LLM dispatcher and its
// provider adapters. No I/O here. Every PA agent + persona call flows through these.

export const LLM_PROVIDERS = [
  "pa_managed",
  "anthropic",
  "openai",
  "groq",
  "custom_openai_compatible",
] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export function isLlmProvider(value: string): value is LlmProvider {
  return (LLM_PROVIDERS as readonly string[]).includes(value);
}

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  pa_managed: "PA-managed Claude",
  anthropic: "Anthropic (BYO)",
  openai: "OpenAI (BYO)",
  groq: "Groq (BYO)",
  custom_openai_compatible: "Local or custom (OpenAI-compatible)",
};

// The default PA-managed model. Every fallback path lands here.
export const PA_MANAGED_MODEL = "claude-sonnet-4-6";

// Quality-bar allowlist. A model NOT in this set triggers the quality-degradation
// banner ("PA's behavior is calibrated for top-tier models — smaller/older models may
// produce lower-quality persona responses"). Locked per SPEC §9.1 + the lane brief.
export const PREMIUM_TIER_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "claude-opus-4-7",
  "gpt-4o",
  "gpt-4.1",
] as const;

/** True when `model` is in the premium-tier allowlist (case-insensitive exact match). */
export function isPremiumTierModel(model: string): boolean {
  const m = model.trim().toLowerCase();
  return (PREMIUM_TIER_MODELS as readonly string[]).some((p) => p.toLowerCase() === m);
}

export const QUALITY_WARNING_MESSAGE =
  "PA's behavior is calibrated for top-tier models — smaller/older models may produce " +
  "lower-quality persona responses.";

// ── Message + request shapes ────────────────────────────────────────────────────────

export type LlmChatMessage = { role: "user" | "assistant"; content: string };

export type LlmCompletionRequest = {
  model: string;
  system: string;
  messages: LlmChatMessage[];
  maxTokens?: number;
};

// ── Normalized stream events ──────────────────────────────────────────────────────────
//
// Each adapter parses its provider's own SSE wire format (Anthropic message events vs
// OpenAI chat.completion chunks) and emits these normalized events so the dispatcher +
// callers never branch on provider.
export type LlmStreamEvent =
  | { type: "delta"; text: string }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "done" }
  | { type: "error"; error: string };

// ── Adapter contract ──────────────────────────────────────────────────────────────────

export type AdapterCallParams = {
  apiKey: string;
  model: string;
  system: string;
  messages: LlmChatMessage[];
  maxTokens: number;
  // Only used by custom_openai_compatible (and overridable for self-hosted gateways).
  endpointUrl?: string;
};

export type StreamOpenResult =
  | { ok: true; stream: ReadableStream<LlmStreamEvent> }
  | { ok: false; status: number; error: string };

export type ListModelsParams = { apiKey: string; endpointUrl?: string };

export type ListModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; status: number; error: string };

export type ProviderAdapter = {
  /** Opens a streaming completion. `ok:false` with status 401 signals an invalid key. */
  streamCompletion(params: AdapterCallParams): Promise<StreamOpenResult>;
  /** Lists available models, when the provider exposes a /models endpoint. */
  listModels?(params: ListModelsParams): Promise<ListModelsResult>;
};
