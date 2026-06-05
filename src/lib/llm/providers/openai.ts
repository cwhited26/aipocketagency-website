// openai.ts — OpenAI provider adapter (GPT-4o / GPT-4.1 / GPT-4.1-mini, etc.). Thin
// wrapper over the shared OpenAI-compatible factory pinned to api.openai.com.

import { makeOpenAiCompatibleAdapter } from "./openai-compatible";

export const OPENAI_BASE = "https://api.openai.com/v1";

const adapter = makeOpenAiCompatibleAdapter(OPENAI_BASE);

export const streamCompletion = adapter.streamCompletion;
export const listModels = adapter.listModels;
export const openaiAdapter = adapter;
