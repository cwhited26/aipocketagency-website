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
  | "follow_up_sweeps"
  | "landing_page_builder"
  | "idea_engine"
  | "rag"
  | "capture_triage"
  // One Haiku call per inbound SMS that looks like a reminder (PC-CORE-5 reminder parse).
  | "pocket_capture_reminders"
  // One row per inbound Channels Gateway roundtrip (PA-CHAN spec §8.4); Slack adapter, Sonnet 4.6.
  | "channels:slack"
  // One row per inbound Channels Gateway roundtrip (Phase 2 Telegram adapter); same meter as Slack.
  | "channels:telegram"
  // One row per inbound Channels Gateway roundtrip (Phase 2 SMS adapter, Twilio); same meter as Slack.
  | "channels:sms"
  // One row per inbound Channels Gateway roundtrip (Phase 3 iMessage adapter, BlueBubbles relay).
  | "channels:imessage"
  // One row per inbound Channels Gateway roundtrip (Phase 4 WhatsApp adapter, Meta Cloud API).
  | "channels:whatsapp"
  // One summary row per Voice Call (Phase 6) + per-turn dispatcher rows; Twilio+ElevenLabs+Whisper+LLM.
  | "voice_call"
  // One row per headless URL extraction run (recon Lane C, PA-CINS); backend 'vercel', priced by run time.
  | "url_extraction"
  // The Competitor Inspector's metered offer-summary call (DNA + role hierarchy only, never copy).
  | "competitor_inspector"
  // One Haiku call per Soul extraction (Pocket_Agent_Soul_System_SPEC_v1) — post-approval or the
  // owner's "Suggest improvements" note. backend 'anthropic', model claude-haiku-4-5-….
  | "soul_extraction"
  // One row per executed browser_* tool call against the hidden headless browser (Browser Automation
  // Phase 1); backend 'vercel', priced by run time like url_extraction.
  | "browser_action"
  // One row per Website Monitoring check tick (cron poll). backend 'vercel'; cost recorded as 0 —
  // the event exists for usage accounting, not billing (a HEAD/GET poll is negligible).
  | "website_monitor"
  // One row per Proposal Generator draft. backend 'anthropic', model claude-sonnet-4-6.
  | "proposal_generator"
  // One row per Browser Agent job step (PA-POS-19): the Computer Use planning tokens + the
  // Browserbase seconds since the last step, idempotency `browser:<jobId>:<step>`.
  | "browser_agent"
  // One row per Custom Agent Builder spec parse (PA-POS-27), idempotency
  // `agent_builder:parse:<buildId>`. Studio+ includes an allowance for composes; overage rides
  // the PA-POS-30 Top Up lane, which reads this ledger.
  | "agent_builder"
  // One Haiku call per owner chat message the Signal Catcher reads (PA-SIGNAL-1), idempotency
  // `signal_catcher:classify:<messageId>`. Studio+/Enterprise only; included in the PA-POS-30
  // credit allowance, which reads this ledger.
  | "signal_catcher"
  // Zero-cost accounting rows for the PA-POS-31 conversion-nudge funnel: one row per nudge
  // impression + one per click-through, metadata.action distinguishes them. backend 'vercel',
  // cost 0 — the event exists so nudge→upgrade conversion is measurable, not for billing.
  | "project_pass_nudge"
  // One row per GHL API call (GHL Agencies SPEC v1 §5.6): backend 'ghl', cost 0 (the agency's
  // own GHL plan covers the API) — the event exists for tier enforcement + observability, with
  // endpoint / location_id / outcome / latency_ms in metadata.
  | "ghl_connector";

/**
 * Which entitlement paid for this usage (PA-POS-31 cost analytics): the owner's tier, an active
 * Project Pass, or Top Up credits past the allowance. Column default is 'tier' (migration 100),
 * so legacy call sites never change — only pass-entitled paths set 'project_pass'.
 */
export type CostEntitlementSource = "tier" | "project_pass" | "top_up";

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
  /** Extra forensic tags merged into the event metadata (e.g. `{ rag_fallback: "exact_cosine" }`). */
  metadata?: Record<string, string>;
  /** Rented vs tier-included usage (PA-POS-31). Omit = 'tier' (the column default). */
  entitlementSource?: CostEntitlementSource;
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
  /** Extra forensic tags merged into the event metadata (e.g. `{ rag_fallback: "exact_cosine" }`). */
  metadata?: Record<string, string>;
  /** Rented vs tier-included usage (PA-POS-31). Omit = 'tier' (the column default). */
  entitlementSource?: CostEntitlementSource;
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
  // Caller-supplied forensic tags last — they can't shadow the reserved keys above (distinct names).
  if (input.metadata) Object.assign(metadata, input.metadata);

  const row: Record<string, unknown> = {
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
  // Only written when the caller knows the usage was pass- or top-up-entitled; omitting the key
  // lets the column default ('tier') apply, so this insert stays valid pre-migration-100 too.
  if (input.entitlementSource && input.entitlementSource !== "tier") {
    row.entitlement_source = input.entitlementSource;
  }

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
    metadata: cost.metadata,
    entitlementSource: cost.entitlementSource,
  });
}
