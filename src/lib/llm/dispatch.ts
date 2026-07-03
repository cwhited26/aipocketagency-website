// dispatch.ts — the single entry point for EVERY PA agent + persona LLM call. Reads the
// user's saved pa_llm_provider_settings, routes to the chosen provider adapter, and
// falls back to PA-managed Claude (Sonnet 4.6) when the user is unset or their BYO key
// is invalid. Supports streaming (normalized LlmStreamEvent stream) and a one-shot
// aggregated completion.
//
// Quality bar: when the resolved model is outside the premium-tier allowlist, the
// result carries `qualityWarning: true` so the UI can surface the calibration notice.
//
// 401 handling: when a BYO provider returns 401, the dispatcher marks the settings row
// (last_error_at + last_error_code), surfaces `usedFallback` in the result so the API
// layer can show a banner, and silently completes the request on PA-managed Claude.
//
// All external dependencies (settings loader, adapters, error-marker, key-decrypt) are
// injectable via `deps` so routing + fallback are unit-tested without DB or network.

import {
  isPremiumTierModel,
  PA_MANAGED_MODEL,
  type LlmChatMessage,
  type LlmProvider,
  type LlmStreamEvent,
  type ProviderAdapter,
} from "./types";
import {
  loadProviderSettings,
  markProviderError,
  type LlmProviderSettingsRow,
} from "./settings";
import { decryptProviderKey } from "@/lib/crypto/provider-key";
import { anthropicAdapter } from "./providers/anthropic";
import { openaiAdapter } from "./providers/openai";
import { groqAdapter } from "./providers/groq";
import { grokAdapter } from "./providers/grok";
import { customOpenAiCompatibleAdapter } from "./providers/custom_openai_compatible";

const DEFAULT_MAX_TOKENS = 2048;

export function adapterFor(provider: LlmProvider): ProviderAdapter {
  switch (provider) {
    case "openai":
      return openaiAdapter;
    case "groq":
      return groqAdapter;
    case "grok":
      return grokAdapter;
    case "custom_openai_compatible":
      return customOpenAiCompatibleAdapter;
    case "anthropic":
    case "pa_managed":
      return anthropicAdapter;
  }
}

export type DispatchDeps = {
  loadSettings: (userId: string) => Promise<LlmProviderSettingsRow | null>;
  markError: (userId: string, code: string) => Promise<void>;
  decryptKey: (envelope: string) => string;
  adapterFor: (provider: LlmProvider) => ProviderAdapter;
};

const defaultDeps: DispatchDeps = {
  loadSettings: loadProviderSettings,
  markError: markProviderError,
  decryptKey: decryptProviderKey,
  adapterFor,
};

export type DispatchParams = {
  userId: string;
  // The PA-managed Claude key (platform key, or the user's stored Anthropic key as a
  // stand-in until a true platform key is provisioned). Used for the default provider
  // and every fallback. May be empty — then a pa_managed-only request fails cleanly.
  paManagedKey: string;
  system: string;
  messages: LlmChatMessage[];
  maxTokens?: number;
  // Overrides the PA-managed model for this one call — a cheap structured task (a parse, a
  // bucket pick) can ride Haiku instead of the premium default (PA-POS-34: the Agent Builder
  // parse is free on every tier because it's small). BYO targets are never overridden — an
  // owner running their own key keeps the model they chose.
  managedModelOverride?: string;
};

type LlmTarget = {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  endpointUrl?: string;
  qualityWarning: boolean;
};

export type DispatchStreamResult =
  | {
      ok: true;
      stream: ReadableStream<LlmStreamEvent>;
      provider: LlmProvider;
      model: string;
      qualityWarning: boolean;
      usedFallback: boolean;
      fallbackReason: string | null;
    }
  | { ok: false; status: number; error: string };

export type DispatchCompletionResult =
  | {
      ok: true;
      text: string;
      inputTokens: number;
      outputTokens: number;
      provider: LlmProvider;
      model: string;
      qualityWarning: boolean;
      usedFallback: boolean;
      fallbackReason: string | null;
    }
  | { ok: false; status: number; error: string };

// ── Resolution ────────────────────────────────────────────────────────────────────────

function managedTarget(paManagedKey: string, modelOverride?: string): LlmTarget | null {
  if (!paManagedKey) return null;
  return {
    provider: "pa_managed",
    model: modelOverride ?? PA_MANAGED_MODEL,
    apiKey: paManagedKey,
    qualityWarning: false, // PA-managed models are curated — override included
  };
}

/**
 * Resolves the user's primary (BYO) target and the PA-managed fallback target.
 * `primary` is null when the user is on pa_managed or their BYO row is unusable
 * (missing/undecryptable key or missing model) — in which case `configError` explains.
 */
async function resolveTargets(
  params: DispatchParams,
  deps: DispatchDeps,
): Promise<{ primary: LlmTarget | null; managed: LlmTarget | null; configError: string | null }> {
  const managed = managedTarget(params.paManagedKey, params.managedModelOverride);
  let settings: LlmProviderSettingsRow | null = null;
  try {
    settings = await deps.loadSettings(params.userId);
  } catch {
    // Settings read failure → treat as PA-managed default (fail safe, never block).
    return { primary: null, managed, configError: null };
  }

  if (!settings || settings.provider === "pa_managed") {
    return { primary: null, managed, configError: null };
  }

  // BYO provider — require a model + a decryptable key.
  if (!settings.model_id) {
    return { primary: null, managed, configError: "BYO provider has no model selected" };
  }
  if (!settings.encrypted_api_key) {
    return { primary: null, managed, configError: "BYO provider has no API key" };
  }
  let apiKey: string;
  try {
    apiKey = deps.decryptKey(settings.encrypted_api_key);
  } catch {
    return { primary: null, managed, configError: "BYO key could not be decrypted" };
  }
  if (settings.provider === "custom_openai_compatible" && !settings.custom_endpoint_url) {
    return { primary: null, managed, configError: "Custom provider has no endpoint URL" };
  }

  const primary: LlmTarget = {
    provider: settings.provider,
    model: settings.model_id,
    apiKey,
    endpointUrl: settings.custom_endpoint_url ?? undefined,
    qualityWarning: !isPremiumTierModel(settings.model_id),
  };
  return { primary, managed, configError: null };
}

// ── Streaming dispatch ──────────────────────────────────────────────────────────────────

export async function streamLlm(
  params: DispatchParams,
  deps: DispatchDeps = defaultDeps,
): Promise<DispatchStreamResult> {
  const maxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS;
  const { primary, managed, configError } = await resolveTargets(params, deps);

  const openWith = (target: LlmTarget) =>
    deps.adapterFor(target.provider).streamCompletion({
      apiKey: target.apiKey,
      model: target.model,
      system: params.system,
      messages: params.messages,
      maxTokens,
      endpointUrl: target.endpointUrl,
    });

  // 1. Try the BYO primary if present.
  if (primary) {
    const res = await openWith(primary);
    if (res.ok) {
      return {
        ok: true,
        stream: res.stream,
        provider: primary.provider,
        model: primary.model,
        qualityWarning: primary.qualityWarning,
        usedFallback: false,
        fallbackReason: null,
      };
    }
    // On 401 (invalid/expired key) mark the row and silently fall back to PA-managed.
    if (res.status === 401) {
      await deps.markError(params.userId, "401").catch(() => undefined);
      if (managed) {
        const fb = await openWith(managed);
        if (fb.ok) {
          return {
            ok: true,
            stream: fb.stream,
            provider: managed.provider,
            model: managed.model,
            qualityWarning: false,
            usedFallback: true,
            fallbackReason:
              "Your BYO provider key was rejected (401). Falling back to PA-managed Claude.",
          };
        }
        return { ok: false, status: fb.status, error: fb.error };
      }
    }
    // Any other provider error surfaces (no silent masking of e.g. 429 / 500).
    return { ok: false, status: res.status, error: res.error };
  }

  // 2. No usable BYO target → PA-managed. A configError means the BYO row was broken;
  //    we degrade to managed rather than erroring, mirroring the 401 path.
  if (!managed) {
    return {
      ok: false,
      status: 402,
      error:
        configError ??
        "No model provider is configured. Add a provider in Settings → LLM provider.",
    };
  }
  const res = await openWith(managed);
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  return {
    ok: true,
    stream: res.stream,
    provider: managed.provider,
    model: managed.model,
    qualityWarning: false,
    usedFallback: Boolean(configError),
    fallbackReason: configError,
  };
}

// ── One-shot aggregated completion ────────────────────────────────────────────────────

async function drain(stream: ReadableStream<LlmStreamEvent>): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  error: string | null;
}> {
  const reader = stream.getReader();
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let error: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.type === "delta") text += value.text;
    else if (value.type === "usage") {
      inputTokens = value.inputTokens;
      outputTokens = value.outputTokens;
    } else if (value.type === "error") error = value.error;
  }
  return { text, inputTokens, outputTokens, error };
}

export async function completeLlm(
  params: DispatchParams,
  deps: DispatchDeps = defaultDeps,
): Promise<DispatchCompletionResult> {
  const res = await streamLlm(params, deps);
  if (!res.ok) return res;
  const drained = await drain(res.stream);
  if (drained.error) return { ok: false, status: 502, error: drained.error };
  return {
    ok: true,
    text: drained.text,
    inputTokens: drained.inputTokens,
    outputTokens: drained.outputTokens,
    provider: res.provider,
    model: res.model,
    qualityWarning: res.qualityWarning,
    usedFallback: res.usedFallback,
    fallbackReason: res.fallbackReason,
  };
}

// ── Explicit-target completion ──────────────────────────────────────────────────────────
//
// Like completeLlm, but the provider + model + key are chosen by the CALLER rather than read from
// the user's saved settings. This is the seam the Decision Roundtable uses to back its sub-agents
// with DIFFERENT providers in the same run (PA-DR-3 model diversity) — the saved-settings dispatcher
// only ever resolves one primary, so it can't fan a single run across Claude + GPT + Grok. No
// fallback here: the roundtable resolver decides which target each role gets (and supplies a
// pa_managed fallback target it retries with on failure), so this stays a thin one-shot.

export type ExplicitTarget = {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  endpointUrl?: string;
};

export async function completeLlmWithTarget(
  target: ExplicitTarget,
  req: { system: string; messages: LlmChatMessage[]; maxTokens?: number },
  deps: Pick<DispatchDeps, "adapterFor"> = { adapterFor },
): Promise<DispatchCompletionResult> {
  const res = await deps.adapterFor(target.provider).streamCompletion({
    apiKey: target.apiKey,
    model: target.model,
    system: req.system,
    messages: req.messages,
    maxTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    endpointUrl: target.endpointUrl,
  });
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  const drained = await drain(res.stream);
  if (drained.error) return { ok: false, status: 502, error: drained.error };
  return {
    ok: true,
    text: drained.text,
    inputTokens: drained.inputTokens,
    outputTokens: drained.outputTokens,
    provider: target.provider,
    model: target.model,
    qualityWarning: !isPremiumTierModel(target.model),
    usedFallback: false,
    fallbackReason: null,
  };
}

// ── Test-connection ping ────────────────────────────────────────────────────────────────

export type PingResult =
  | { ok: true; latencyMs: number; modelEcho: string; qualityWarning: boolean }
  | { ok: false; status: number; error: string };

/**
 * A 5-token sanity ping against an explicit provider + model + key (NOT the saved
 * settings — used by the Test connection button before Save). Returns round-trip
 * latency and the echoed model id.
 */
export async function pingProvider(
  params: {
    provider: LlmProvider;
    model: string;
    apiKey: string;
    endpointUrl?: string;
  },
  deps: Pick<DispatchDeps, "adapterFor"> = { adapterFor },
): Promise<PingResult> {
  const start = Date.now();
  const res = await deps.adapterFor(params.provider).streamCompletion({
    apiKey: params.apiKey,
    model: params.model,
    system: "You are a connectivity check. Reply with the single word: ok.",
    messages: [{ role: "user", content: "ping" }],
    maxTokens: 5,
    endpointUrl: params.endpointUrl,
  });
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  const drained = await drain(res.stream);
  const latencyMs = Date.now() - start;
  if (drained.error) return { ok: false, status: 502, error: drained.error };
  return {
    ok: true,
    latencyMs,
    modelEcho: params.model,
    qualityWarning: !isPremiumTierModel(params.model),
  };
}
