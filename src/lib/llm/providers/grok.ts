// grok.ts — xAI Grok provider adapter. NOTE: Grok (xAI's LLM, e.g. grok-4.3) is NOT
// Groq (the fast-inference hardware company in groq.ts) — they are different vendors that
// happen to look alike. xAI exposes an OpenAI-compatible API, so this is the same shared
// factory pinned to xAI's base URL. xAI serves /v1/models, so listModels works.

import { makeOpenAiCompatibleAdapter } from "./openai-compatible";

export const GROK_BASE = "https://api.x.ai/v1";

const adapter = makeOpenAiCompatibleAdapter(GROK_BASE);

export const streamCompletion = adapter.streamCompletion;
export const listModels = adapter.listModels;
export const grokAdapter = adapter;
