// cost.ts — RAG cost-ledger writes (PA-RAG-6). Every Modal build and every embedding call writes one
// pa_cost_events row via the Cost Observability Phase 1 helper (lib/cost/log), featureSlug "rag",
// with a DETERMINISTIC idempotency key so a retried realized cost collapses to one ledger row.
//
// Embedding pricing lives here rather than in lib/cost/prices because that table's `openai` backend
// prices Whisper audio-minutes, not embedding tokens. The rates are per-1M-token list prices for the
// OpenAI embedding family (the BYO default per SPEC §3.5); an unknown model degrades to the -small
// rate rather than dropping the cost.

import { logCostEvent, logCostFromUsage, type CostContext } from "@/lib/cost/log";

// USD per 1,000,000 tokens (OpenAI embedding list prices).
const EMBED_USD_PER_MTOK: Record<string, number> = {
  "text-embedding-3-small": 0.02,
  "text-embedding-3-large": 0.13,
  "text-embedding-ada-002": 0.1,
};
const EMBED_DEFAULT_USD_PER_MTOK = EMBED_USD_PER_MTOK["text-embedding-3-small"];
const USD_TO_CENTS = 100;

function embedCostCents(model: string, tokens: number): number {
  const rate = EMBED_USD_PER_MTOK[model] ?? EMBED_DEFAULT_USD_PER_MTOK;
  return (tokens / 1_000_000) * rate * USD_TO_CENTS;
}

/** One cost-ledger row for an embedding batch (build) or a single query embed. Never throws. */
export async function logRagEmbedCost(input: {
  ownerId: string;
  embeddingModel: string;
  tokens: number;
  idempotencyKey: string;
}): Promise<void> {
  await logCostEvent({
    ownerId: input.ownerId,
    featureSlug: "rag",
    backend: "openai",
    model: input.embeddingModel,
    costCents: embedCostCents(input.embeddingModel, input.tokens),
    tokensInput: input.tokens,
    idempotencyKey: input.idempotencyKey,
  });
}

/** One cost-ledger row for the Modal compute a build / query consumed. Never throws. */
export async function logRagModalCost(input: {
  ownerId: string;
  cpuSeconds: number;
  idempotencyKey: string;
}): Promise<void> {
  const ctx: CostContext = {
    ownerId: input.ownerId,
    featureSlug: "rag",
    idempotencyKey: input.idempotencyKey,
  };
  await logCostFromUsage(ctx, "modal", null, { cpuSeconds: input.cpuSeconds });
}
