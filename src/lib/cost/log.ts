// log.ts — the cost ledger writer (Cost Observability SPEC §5.2). Every metered API call writes one
// pa_cost_events row at the moment its cost is realized (after the provider returns its usage payload).
// Direct service-role REST (no SDK — repo rule); never throws (a logging failure must never break the
// metered work it's measuring). Append-only: the table has no UPDATE/DELETE policy, and a duplicate
// idempotency_key is swallowed silently — that's the design (a retry of the same realized cost must
// not double-count), not an error.
//
// Storage unit is MICRO-CENTS (1/10,000 of a cent; 1 USD = 1,000,000 micro-cents — PA-COST-9) so sub-cent
// events (a single Haiku classify, one Bright Data request) stay lossless instead of rounding to zero.
// The BIGINT cost_micro_cents column carries the precise value; the legacy unit_cost_cents column is
// GENERATED (floor of micro/10000) by migration 056, so we never write it.
//
// Two entry points:
//   logCostEvent(...)     — the SPEC §5.2 primitive. Caller supplies the already-computed costMicroCents.
//   logCostFromUsage(...) — the ergonomic wrapper call sites use: pass the CostContext + the raw usage
//                           payload and it prices via lib/cost/prices and forwards to logCostEvent.

import { getCostMicroCents, type CostBackend, type CostUsage } from "./prices";

export type CostFeatureSlug =
  | "podcast"
  | "youtube"
  | "lead_scout"
  | "roundtable"
  | "chat"
  | "email_drafter"
  | "build_tools"
  | "rag";

/**
 * The per-call-site context a metered backend carries: who's paying, which feature area, and a
 * DETERMINISTIC idempotency key (never random) so a retry collapses to one ledger row. The leaf API
 * function fills in backend/model/cost; the caller supplies this.
 */
export type CostContext = {
  ownerId: string;
  featureSlug: CostFeatureSlug;
  /** Deterministic per-realized-cost key, e.g. `${runId}:${i}:extract`. Required (SPEC §5.2). */
  idempotencyKey: string;
  /** The originating sub-agent run, when this cost came from a dispatched leaf task. */
  subAgentRunId?: string;
  /** The conversation this cost is attributable to, for chat-surface forensics. */
  conversationId?: string;
};

export type LogCostEventInput = {
  ownerId: string;
  featureSlug: CostFeatureSlug;
  backend: CostBackend;
  model?: string;
  /** Realized cost in micro-cents (may be fractional — rounded to the integer BIGINT column on write). */
  costMicroCents: number;
  tokensInput?: number;
  tokensOutput?: number;
  idempotencyKey: string;
  subAgentRunId?: string;
  conversationId?: string;
};

const TABLE = "pa_cost_events";
// PostgREST raises 23505 on a unique-constraint violation — here, a duplicate idempotency_key. That's
// the idempotency guard doing its job, so we swallow it; everything else surfaces as a structured warn.
const UNIQUE_VIOLATION = "23505";

function paEnv(): { url: string; key: string } | null {
  const url =
    process.env.POCKET_AGENT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.WC_ADMIN_SUPABASE_URL;
  const key =
    process.env.POCKET_AGENT_SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.WC_ADMIN_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

/**
 * Write one cost event. Idempotent by `idempotencyKey` (a duplicate is swallowed by design). Never
 * throws — a ledger-write failure is logged and dropped so it can't break the metered call it measures.
 * Returns void (SPEC §5.2).
 */
export async function logCostEvent(input: LogCostEventInput): Promise<void> {
  const env = paEnv();
  if (!env) {
    console.warn("[cost/log] Supabase service-role env not set — cost event dropped", {
      featureSlug: input.featureSlug,
      backend: input.backend,
    });
    return;
  }

  const metadata: Record<string, string> = { idempotency_key: input.idempotencyKey };
  if (input.subAgentRunId) metadata.sub_agent_run_id = input.subAgentRunId;
  if (input.conversationId) metadata.conversation_id = input.conversationId;

  const row = {
    owner_id: input.ownerId,
    feature_slug: input.featureSlug,
    backend: input.backend,
    model: input.model ?? null,
    // The column is BIGINT micro-cents; round to whole micro-cents here (the price math can be fractional,
    // e.g. one Haiku input token = 0.8 micro-cents) — never to whole cents, which is the rounding-to-zero
    // bug 056 fixes. unit_cost_cents is GENERATED from this in Postgres, so it's never written here.
    cost_micro_cents: Math.round(input.costMicroCents),
    tokens_input: input.tokensInput ?? null,
    tokens_output: input.tokensOutput ?? null,
    metadata,
  };

  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
      cache: "no-store",
    });
  } catch (e) {
    console.warn("[cost/log] cost event insert failed (network)", {
      featureSlug: input.featureSlug,
      error: e instanceof Error ? e.message : String(e),
    });
    return;
  }

  if (res.ok) return;

  // A duplicate idempotency_key is the guard working — swallow it silently.
  const body = await res.text().catch(() => "");
  if (res.status === 409 || body.includes(UNIQUE_VIOLATION)) return;

  console.warn("[cost/log] cost event insert rejected", {
    featureSlug: input.featureSlug,
    backend: input.backend,
    status: res.status,
    body: body.slice(0, 200),
  });
}

/**
 * Ergonomic call-site wrapper: price `usage` via lib/cost/prices and write the event. This is what the
 * metered leaf functions call once they have the response in hand — one line, zero pricing math at the
 * call site. Forwards token counts to the ledger when present.
 */
export async function logCostFromUsage(
  cost: CostContext,
  backend: CostBackend,
  model: string | null,
  usage: CostUsage,
): Promise<void> {
  await logCostEvent({
    ownerId: cost.ownerId,
    featureSlug: cost.featureSlug,
    backend,
    model: model ?? undefined,
    costMicroCents: getCostMicroCents(backend, model, usage),
    tokensInput: usage.tokensInput,
    tokensOutput: usage.tokensOutput,
    idempotencyKey: cost.idempotencyKey,
    subAgentRunId: cost.subAgentRunId,
    conversationId: cost.conversationId,
  });
}
