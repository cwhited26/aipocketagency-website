// custom_openai_compatible.ts — generic OpenAI-API-compatible endpoint. The user
// supplies their own base URL (Ollama / LM Studio / vLLM / Together / Anyscale / any
// gateway that speaks the OpenAI Chat Completions wire protocol). No fixed base URL —
// every call MUST pass `endpointUrl`. listModels works only if the endpoint serves
// `/v1/models`; callers fall back to manual model entry when it doesn't.

import { makeOpenAiCompatibleAdapter } from "./openai-compatible";

// No fixed base — the per-call endpointUrl is required.
const adapter = makeOpenAiCompatibleAdapter();

export const streamCompletion = adapter.streamCompletion;
export const listModels = adapter.listModels;
export const customOpenAiCompatibleAdapter = adapter;
