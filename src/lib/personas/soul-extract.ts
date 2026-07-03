// soul-extract.ts — the Soul extractor (SPEC §Extraction pipeline). After a Persona conversation
// lands an Inbox approval, a lightweight Haiku call asks: did the owner reveal anything about HOW they
// prefer to be worked with? It returns zero-to-three observations {kind, summary, body, confidence}.
// The same extractor backs the "Suggest improvements" box on the Soul page, where the owner's note IS
// the input.
//
// Confidence routes each observation (SPEC §Extraction pipeline):
//   < 0.5         → discarded.
//   0.5 .. 0.8    → staged as a soul_attribute_proposal Inbox card (one-click approve).
//   > 0.8         → written straight into the Soul.
//
// Every write runs the supersession merge first (soul-merge.ts): a new observation that's about the
// same dimension as an existing live attribute of the same kind replaces it (the old row's
// superseded_by is pointed at the new one). Net-new observations grow the Soul up to the tier cap;
// over cap, the lowest-confidence live attribute is evicted so the footprint stays bounded.
//
// The Haiku call is direct Anthropic REST (no SDK — repo rule), keyed by the owner's stored Anthropic
// key, and logs one pa_cost_events row per call via featureSlug 'soul_extraction'. It is injectable so
// the routing is unit-tested without a network. It never throws — a parse/API failure yields zero
// observations, never an over-eager write.

import { z } from "zod";
import { extractJsonObject } from "@/lib/orchestrator/planner";
import { logCostFromUsage, type CostContext } from "@/lib/cost/log";
import { createInboxItem, listInboxItems, type InboxItem } from "@/lib/pa-inbox-items";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchPersona } from "./db";
import {
  getCurrentTier,
  resolveSoulExtraction,
  soulActiveCap,
  tierAllowsSoulExtraction,
  type Tier,
} from "./tier-caps";
import { getPersonaDisplayName, isPublicMode, type PersonaMode } from "./types";
import {
  countLiveForPersona,
  insertSoulAttribute,
  listLiveForPersona,
  supersedeSoulAttribute,
  type SoulResult,
} from "./soul-db";
import { findSupersededAttribute, isDuplicateOfLive } from "./soul-merge";
import {
  clampConfidence,
  routeByConfidence,
  SoulExtractDecisionSchema,
  SOUL_KIND_LABELS,
  type SoulAttributeKind,
  type SoulAttributeRow,
  type SoulObservation,
} from "./soul-types";

export const SOUL_ATTRIBUTE_PROPOSAL_KIND = "soul_attribute_proposal" as const;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const EXTRACT_MODEL = "claude-haiku-4-5-20251001"; // cheap — the SPEC's "lightweight Haiku call"

// ── LLM interface (injected so the extractor is unit-tested without a network) ───────────────
export type SoulExtractLlm = (args: {
  system: string;
  user: string;
}) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;

// ── Extractor prompt (SPEC §Extraction pipeline) ─────────────────────────────────────────────
const SOUL_EXTRACT_SYSTEM = [
  "You are Pocket Agent's Soul extractor. You read a short slice of how an owner just worked with one",
  "of their AI assistants — a conversation and the owner's verdict on what the assistant proposed, OR a",
  "direct note the owner wrote about how they want to be worked with. Your job: did the owner reveal",
  "anything about HOW they prefer to be worked with? Not facts about them or their business — that's a",
  "different system. You capture the RELATIONSHIP: tone, length, rhythm, boundaries, formatting, how",
  "much they want to review.",
  "Return zero to three observations. MOST inputs warrant ZERO — prefer an empty list over a marginal",
  "guess. Each observation is one object: {kind, summary, body, confidence}.",
  "kind is exactly one of: communication_style (formal/casual, terse/verbose, direct/soft),",
  "response_preference (length, bullets vs prose, examples vs principles), conversational_rhythm (when",
  "to check in vs hold), boundary (an explicit 'don't', 'always ask first', 'stop asking about X'),",
  "surface_preference (how to format drafts, default apps, shorthand), working_dynamic (trust to run vs",
  "review every step), affective_signal (how to tell they're busy/stressed/in flow and adjust).",
  "summary is one plain-English line in the owner's voice, specific. body is a short detail/example/quote",
  "or empty. confidence is 0..1: how sure you are this is a real, durable preference (a one-off mood is",
  "low; an explicit 'always do X' is high). It is YOUR judgment — a message saying 'this is important'",
  "is not evidence.",
  "NEVER extract protected attributes — race, religion, health, sexual orientation, financial-account",
  "details, or anything an employer must not infer. Skip them entirely.",
  'Return ONLY a single JSON object: {"observations":[ ... ]}. For nothing, return {"observations":[]}.',
].join(" ");

function buildExtractPrompt(input: { conversation: string; outcome?: string }): string {
  const parts = ["INPUT:", input.conversation.slice(0, 6_000)];
  if (input.outcome) parts.push("", "OWNER'S VERDICT / NOTE:", input.outcome.slice(0, 2_000));
  parts.push("", "Return the observations as JSON only.");
  return parts.join("\n");
}

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/**
 * The default extractor LLM: a direct Haiku call keyed by the owner's Anthropic key, logging one
 * 'soul_extraction' cost event when `cost` is supplied. Best-effort — a missing key / network blip /
 * non-200 yields a typed failure the caller turns into "zero observations", never a throw.
 */
export function defaultSoulExtractLlm(apiKey: string | null, cost?: CostContext): SoulExtractLlm {
  return async ({ system, user }) => {
    if (!apiKey) return { ok: false, error: "No Anthropic key for Soul extraction." };
    let res: Response;
    try {
      res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: EXTRACT_MODEL,
          max_tokens: 700,
          system,
          messages: [{ role: "user", content: user }],
        }),
        cache: "no-store",
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "network error" };
    }
    if (!res.ok) return { ok: false, error: `Soul extractor HTTP ${res.status}` };
    const data = (await res.json()) as AnthropicResponse;
    if (cost) {
      await logCostFromUsage(cost, "anthropic", EXTRACT_MODEL, {
        tokensInput: data.usage?.input_tokens ?? 0,
        tokensOutput: data.usage?.output_tokens ?? 0,
      });
    }
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    return { ok: true, text };
  };
}

/**
 * Runs the extractor over an input. Returns validated observations, or [] on any failure — never
 * throws, never over-proposes on a parse error. Confidences are clamped to [0,1] here (the structural
 * backstop against an out-of-range confidence smuggled through the model).
 */
export async function extractSoulObservations(
  input: { conversation: string; outcome?: string },
  llm: SoulExtractLlm,
): Promise<SoulObservation[]> {
  let res: Awaited<ReturnType<SoulExtractLlm>>;
  try {
    res = await llm({ system: SOUL_EXTRACT_SYSTEM, user: buildExtractPrompt(input) });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const json = extractJsonObject(res.text);
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  const parsed = SoulExtractDecisionSchema.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.observations.map((o) => ({ ...o, confidence: clampConfidence(o.confidence) }));
}

// ── Write path (supersession merge + cap) ────────────────────────────────────────────────────

/** Lowest-confidence live attribute, oldest on a tie — the overflow eviction victim when a net-new
 *  attribute would push a Persona past its cap. Pure. */
export function selectSoulOverflowVictim(
  live: readonly SoulAttributeRow[],
): SoulAttributeRow | null {
  let victim: SoulAttributeRow | null = null;
  for (const a of live) {
    if (victim === null) {
      victim = a;
      continue;
    }
    if (a.confidence < victim.confidence) victim = a;
    else if (a.confidence === victim.confidence && a.created_at < victim.created_at) victim = a;
  }
  return victim;
}

export type SoulWriteInput = {
  personaId: string;
  ownerId: string;
  tier: Tier;
  kind: SoulAttributeKind;
  summary: string;
  body?: string | null;
  confidence: number;
  sourceSessionId?: string | null;
  locked?: boolean;
};

/**
 * Insert one attribute, running the supersession merge first. If the candidate is about the same
 * dimension as an existing live attribute of its kind, that attribute is retired (superseded) — net
 * count unchanged. Otherwise it's net-new: if the Persona is already at its cap, the lowest-confidence
 * live attribute is evicted to make room (best-effort — a failed evict leaves the Persona one over).
 */
export async function writeSoulAttribute(input: SoulWriteInput): Promise<SoulResult<SoulAttributeRow>> {
  const liveRes = await listLiveForPersona(input.personaId);
  const live = liveRes.ok ? liveRes.data : [];
  const victim = findSupersededAttribute(live, {
    kind: input.kind,
    summary: input.summary,
    body: input.body ?? null,
  });

  const inserted = await insertSoulAttribute({
    personaId: input.personaId,
    ownerId: input.ownerId,
    kind: input.kind,
    summary: input.summary,
    body: input.body ?? null,
    confidence: clampConfidence(input.confidence),
    sourceSessionId: input.sourceSessionId ?? null,
    locked: input.locked ?? false,
  });
  if (!inserted.ok) return inserted;

  if (victim && victim.id !== inserted.data.id) {
    await supersedeSoulAttribute(victim.id, inserted.data.id);
    return inserted;
  }

  // Net-new — enforce the per-Persona cap by evicting the weakest live attribute when over.
  const cap = soulActiveCap(input.tier);
  if (cap !== null && live.length >= cap) {
    const evict = selectSoulOverflowVictim(live);
    if (evict && evict.id !== inserted.data.id) await supersedeSoulAttribute(evict.id, inserted.data.id);
  }
  return inserted;
}

// ── Proposal staging (mid-confidence) ────────────────────────────────────────────────────────

const ProposalPayloadSchema = z.object({
  personaId: z.string().min(1),
  personaName: z.string().min(1).optional(),
  kind: z.enum([
    "communication_style",
    "response_preference",
    "conversational_rhythm",
    "boundary",
    "surface_preference",
    "working_dynamic",
    "affective_signal",
  ]),
  summary: z.string().trim().min(1).max(240),
  body: z.string().trim().max(4_000).nullable().optional(),
  confidence: z.number().min(0).max(1),
});
export type SoulProposalPayload = z.infer<typeof ProposalPayloadSchema>;

function proposalBody(o: SoulObservation): string {
  return [
    `**${SOUL_KIND_LABELS[o.kind]}**`,
    "",
    o.summary.trim(),
    ...(o.body ? ["", o.body.trim()] : []),
    "",
    "Approve to teach it to this assistant, edit it first, or skip.",
  ].join("\n");
}

/** True when this observation is already held live, or already proposed-pending / rejected — so the
 *  extractor never re-proposes something the owner already keeps or already turned down. */
export function isSoulProposalSuppressed(
  o: SoulObservation,
  personaId: string,
  live: readonly SoulAttributeRow[],
  existingInbox: readonly InboxItem[],
): boolean {
  if (isDuplicateOfLive(live, { kind: o.kind, summary: o.summary, body: o.body ?? null })) return true;
  const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");
  const key = norm(o.summary);
  return existingInbox.some((item) => {
    if (item.kind !== SOUL_ATTRIBUTE_PROPOSAL_KIND) return false;
    if (item.status !== "pending" && item.status !== "rejected") return false;
    const p = item.payload as { personaId?: unknown; kind?: unknown; summary?: unknown };
    return (
      p.personaId === personaId &&
      p.kind === o.kind &&
      typeof p.summary === "string" &&
      norm(p.summary) === key
    );
  });
}

// ── Orchestration ──────────────────────────────────────────────────────────────────────────

export type SoulRouteResult =
  | { action: "auto_written"; soulId: string }
  | { action: "staged"; inboxItemId: string }
  | { action: "discarded" }
  | { action: "suppressed" }
  | { action: "error"; error: string };

async function routeObservation(input: {
  persona: { id: string; name: string; display_name?: string | null };
  ownerId: string;
  tier: Tier;
  observation: SoulObservation;
  sourceSessionId: string | null;
  live: readonly SoulAttributeRow[];
  existingInbox: readonly InboxItem[];
}): Promise<SoulRouteResult> {
  const o = input.observation;
  const route = routeByConfidence(o.confidence);
  if (route === "discard") return { action: "discarded" };

  if (route === "auto") {
    const written = await writeSoulAttribute({
      personaId: input.persona.id,
      ownerId: input.ownerId,
      tier: input.tier,
      kind: o.kind,
      summary: o.summary,
      body: o.body ?? null,
      confidence: o.confidence,
      sourceSessionId: input.sourceSessionId,
    });
    if (!written.ok) return { action: "error", error: written.error };
    return { action: "auto_written", soulId: written.data.id };
  }

  // Mid-confidence → stage a proposal (unless already held or already proposed).
  if (isSoulProposalSuppressed(o, input.persona.id, input.live, input.existingInbox)) {
    return { action: "suppressed" };
  }
  const created = await createInboxItem({
    userId: input.ownerId,
    kind: SOUL_ATTRIBUTE_PROPOSAL_KIND,
    title: `${getPersonaDisplayName(input.persona)} noticed how you like to work`,
    bodyMd: proposalBody(o),
    source: "persona-soul",
    payload: {
      personaId: input.persona.id,
      personaName: getPersonaDisplayName(input.persona),
      kind: o.kind,
      summary: o.summary,
      body: o.body ?? null,
      confidence: o.confidence,
    },
  });
  if (!created.ok) return { action: "error", error: created.error };
  return { action: "staged", inboxItemId: created.data.id };
}

export type SoulExtractionTrigger = "continuous" | "explicit";

export type SoulExtractionSummary =
  | { ok: true; skipped: "public_mode" | "read_only" | "opt_in_pending" }
  | { ok: true; results: SoulRouteResult[] };

/**
 * The Soul extraction entry the approve route (trigger 'continuous') and the "Suggest improvements"
 * box (trigger 'explicit') call. Applies tier gating, runs the extractor, and routes each observation
 * (auto-write / stage / discard). Public Personas never extract (SPEC §Privacy). Best-effort: the
 * caller wraps it so an extraction error never fails the work that triggered it.
 *
 *   • continuous → gated by resolveSoulExtraction (off / opt-in-pending / on per tier).
 *   • explicit   → gated only by tierAllowsSoulExtraction (the owner is directly asking); read-only
 *                  Personal tier still can't spend a model call, so it's skipped 'read_only'.
 */
export async function runSoulExtraction(input: {
  persona: { id: string; name: string; display_name?: string | null; mode: PersonaMode };
  ownerId: string;
  tier: Tier;
  trigger: SoulExtractionTrigger;
  conversation: string;
  outcome?: string;
  sourceSessionId?: string | null;
  llm: SoulExtractLlm;
}): Promise<SoulExtractionSummary> {
  if (isPublicMode(input.persona.mode)) return { ok: true, skipped: "public_mode" };

  const liveRes = await listLiveForPersona(input.persona.id);
  const live = liveRes.ok ? liveRes.data : [];

  if (input.trigger === "continuous") {
    const decision = resolveSoulExtraction(input.tier, { personaHasSoul: live.length > 0 });
    if (!decision.allowed) return { ok: true, skipped: decision.reason };
  } else if (!tierAllowsSoulExtraction(input.tier)) {
    return { ok: true, skipped: "read_only" };
  }

  const observations = await extractSoulObservations(
    { conversation: input.conversation, outcome: input.outcome },
    input.llm,
  );
  if (observations.length === 0) return { ok: true, results: [] };

  const inboxRes = await listInboxItems(input.ownerId);
  const existingInbox = inboxRes.ok ? inboxRes.data : [];

  const results: SoulRouteResult[] = [];
  for (const observation of observations) {
    results.push(
      await routeObservation({
        persona: { id: input.persona.id, name: input.persona.name, display_name: input.persona.display_name ?? null },
        ownerId: input.ownerId,
        tier: input.tier,
        observation,
        sourceSessionId: input.sourceSessionId ?? null,
        live,
        existingInbox,
      }),
    );
  }
  return { ok: true, results };
}

// ── Continuous extraction from an Inbox resolution (SPEC §Extraction pipeline) ─────────────────
//
// The SPEC's continuous trigger: after a Persona conversation lands an Inbox approval (approved,
// rejected, or edited-then-approved), run the extractor over that conversation + the owner's verdict.
// The approve/reject routes call this for any persona-tied card (one whose payload carries a
// personaId). Best-effort and self-contained: it resolves the persona, tier, and model key itself, and
// never throws — a failure here must never undo the approval that triggered it. soul_attribute_proposal
// cards are skipped (extracting from the Soul's own approvals would recurse).
export async function extractSoulFromInboxResolution(input: {
  item: InboxItem;
  outcome: "approved" | "rejected";
}): Promise<void> {
  const { item, outcome } = input;
  if (item.kind === SOUL_ATTRIBUTE_PROPOSAL_KIND) return;

  const personaId = typeof item.payload.personaId === "string" ? item.payload.personaId : null;
  if (!personaId) return;

  const persona = await fetchPersona(personaId);
  if (!persona || persona.business_id !== item.user_id) return;
  if (isPublicMode(persona.mode)) return;

  const pa = await fetchPaUser(item.user_id);
  const apiKey = pa.ok && pa.data ? pa.data.anthropic_api_key ?? null : null;
  if (!apiKey) return;

  const tier = await getCurrentTier(item.user_id);
  const conversationId =
    typeof item.payload.conversationId === "string" ? item.payload.conversationId : null;

  const conversation = [item.title, item.body_md ?? ""].filter(Boolean).join("\n\n");
  const llm = defaultSoulExtractLlm(apiKey, {
    ownerId: item.user_id,
    featureSlug: "soul_extraction",
    idempotencyKey: `soul-approval:${item.id}`,
    ...(conversationId ? { conversationId } : {}),
  });

  await runSoulExtraction({
    persona: { id: persona.id, name: persona.name, display_name: persona.display_name ?? null, mode: persona.mode },
    ownerId: item.user_id,
    tier,
    trigger: "continuous",
    conversation,
    outcome: `The owner ${outcome} what this assistant proposed.`,
    sourceSessionId: conversationId,
    llm,
  });
}

// ── Manual add (owner-authored, no model call — allowed on every tier) ─────────────────────────

/** The owner adds a Soul attribute by hand from the Soul page. Allowed on every tier (even read-only
 *  Personal), capped by the tier. Written at high confidence — the owner stated it directly. */
export async function addSoulAttributeManually(input: {
  personaId: string;
  ownerId: string;
  tier: Tier;
  kind: SoulAttributeKind;
  summary: string;
  body?: string | null;
}): Promise<SoulResult<SoulAttributeRow>> {
  const count = await countLiveForPersona(input.personaId);
  const cap = soulActiveCap(input.tier);
  if (count.ok && cap !== null && count.data >= cap) {
    return {
      ok: false,
      status: 409,
      error: `This assistant's Soul is full at ${cap} attributes on your plan. Retire one to add another, or upgrade.`,
    };
  }
  return writeSoulAttribute({
    personaId: input.personaId,
    ownerId: input.ownerId,
    tier: input.tier,
    kind: input.kind,
    summary: input.summary,
    body: input.body ?? null,
    confidence: 0.9,
  });
}

// ── Proposal acceptance (the Inbox approve route calls this) ───────────────────────────────────

/**
 * Write the attribute an owner approved from a soul_attribute_proposal card, honouring any owner edit
 * the approve route passed through. Runs the same supersession merge + cap as an auto-write. Returns
 * the new attribute id, or a typed error the route surfaces.
 */
export async function acceptSoulProposal(input: {
  ownerId: string;
  tier: Tier;
  payload: unknown;
  override?: { summary?: string; body?: string | null };
}): Promise<SoulResult<SoulAttributeRow>> {
  const parsed = ProposalPayloadSchema.safeParse(input.payload);
  if (!parsed.success) {
    return { ok: false, status: 422, error: "This proposal is missing its details." };
  }
  const p = parsed.data;
  const summary = (input.override?.summary ?? p.summary).trim();
  if (!summary) return { ok: false, status: 422, error: "Nothing to save — the attribute is empty." };
  const body = input.override?.body !== undefined ? input.override.body : p.body ?? null;

  return writeSoulAttribute({
    personaId: p.personaId,
    ownerId: input.ownerId,
    tier: input.tier,
    kind: p.kind,
    summary,
    body,
    // An owner-approved proposal is a confirmed preference — store it at the confidence the owner
    // signed off on, floored so it clears the read threshold immediately.
    confidence: Math.max(clampConfidence(p.confidence), 0.75),
  });
}
