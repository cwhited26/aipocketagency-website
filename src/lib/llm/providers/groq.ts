// groq.ts — Groq provider adapter. Groq exposes an OpenAI-compatible API, so this is
// the same shared factory pinned to Groq's OpenAI-compatible base URL. Groq supports
// /models, so listModels works.

import { makeOpenAiCompatibleAdapter } from "./openai-compatible";

export const GROQ_BASE = "https://api.groq.com/openai/v1";

const adapter = makeOpenAiCompatibleAdapter(GROQ_BASE);

export const streamCompletion = adapter.streamCompletion;
export const listModels = adapter.listModels;
export const groqAdapter = adapter;
