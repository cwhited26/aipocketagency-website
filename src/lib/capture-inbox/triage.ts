// triage.ts — the triage helper (PA-CAPTURE-2): the Monday-morning sweep that reads the still-unfiled
// memory/inbox.md entries, classifies each with one cheap Haiku call, and stages a
// capture_triage_proposal card the owner approves / rejects / edits.
//
// The classifier reuses the YouTube classifier's pattern verbatim — a single cheap Haiku call that
// returns ONE word, degrading to a safe default on no-key / API error / unparseable output, never
// throwing (see src/lib/youtube/classify.ts classifyBucket). The capture buckets extend that 4-bucket
// set with 'personal' and 'unsure' (the honest "couldn't place it" fallback). Every classify call
// logs one cost event: featureSlug 'capture_triage', backend 'anthropic', model claude-haiku-4-5-…,
// idempotency key `triage:${entryId}`.
//
// Acceptance (acceptTriageProposal) files the entry into the suggested (or owner-edited) brain path
// and prunes it from the inbox via the cleanup pass. Brand hard rules: direct REST, no `any`, no
// silent catch.

import { logCostFromUsage, type CostContext } from "@/lib/cost/log";
import { fetchFileContent } from "@/lib/pa-brain";
import { parseInboxForDisplay, type InboxEntry } from "@/lib/pa-inbox";
import { createInboxItem, listInboxItems } from "@/lib/pa-inbox-items";
import { writeCaptureNote, type CaptureWriteCtx } from "./rules";
import { pruneInboxEntry } from "./cleanup";
import {
  CAPTURE_TRIAGE_PROPOSAL_KIND,
  TRIAGE_BUCKET_DIRS,
  TRIAGE_BUCKET_LABELS,
  type CaptureTriagePayload,
  type TriageBucket,
  isTriageBucket,
  slugify,
} from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLASSIFY_MODEL = "claude-haiku-4-5-20251001"; // cheap — a one-word bucket pick

const INBOX_PATH = "memory/inbox.md";

// ── Classify (cheap, Haiku) ──────────────────────────────────────────────────────
// Adapted verbatim from the YouTube classifier (src/lib/youtube/classify.ts CLASSIFY_PROMPT): one
// cheap Haiku call, EXACTLY one word back, degrade to the default bucket on anything unexpected. The
// option list is the capture triage set ('competitor' → 'competitive', plus 'personal' / 'unsure').
const TRIAGE_PROMPT = `You sort one captured note from a small-business owner's inbox into ONE bucket. Reply with EXACTLY one word, nothing else:

- competitive — about a competitor, a rival's launch, pricing, or company news (the owner wants what a rival claimed)
- tactic — a sales/marketing/how-to/business technique worth keeping (the owner wants the play)
- testimonial — a customer quote, review, or case study (the owner wants lift-and-paste proof)
- industry — an industry update, news, or trend in the owner's field (the owner wants a summary)
- personal — a personal note, reminder, or idea about the owner's own life or business, not the market
- unsure — none of the above, or too little to tell

Answer with one word from: competitive, tactic, testimonial, industry, personal, unsure.`;

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/**
 * Classify one inbox entry into a triage bucket via a cheap Haiku call. Degrades to "unsure" on
 * no-key / API error / unparseable output — never throws. Logs one anthropic cost event when `cost`
 * is supplied.
 */
export async function classifyTriageBucket(params: {
  apiKey: string | null;
  entry: Pick<InboxEntry, "title" | "content" | "sourceUrl">;
  cost?: CostContext;
}): Promise<TriageBucket> {
  if (!params.apiKey) return "unsure";

  const input = [
    params.entry.title ? `Title: ${params.entry.title}` : "",
    params.entry.sourceUrl ? `Source: ${params.entry.sourceUrl}` : "",
    `Note: ${params.entry.content.slice(0, 800)}`,
  ]
    .filter(Boolean)
    .join("\n");

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": params.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLASSIFY_MODEL,
        max_tokens: 8,
        messages: [{ role: "user", content: `${TRIAGE_PROMPT}\n\n${input}` }],
      }),
      cache: "no-store",
    });
  } catch {
    return "unsure"; // classifier is best-effort; a network blip means "unsure", not a crash
  }
  if (!res.ok) return "unsure";

  const data = (await res.json()) as AnthropicResponse;
  if (params.cost) {
    await logCostFromUsage(params.cost, "anthropic", CLASSIFY_MODEL, {
      tokensInput: data.usage?.input_tokens ?? 0,
      tokensOutput: data.usage?.output_tokens ?? 0,
    });
  }
  const word = (data.content?.find((c) => c.type === "text")?.text ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return isTriageBucket(word) ? word : "unsure";
}

// ── Suggested target path ─────────────────────────────────────────────────────────

/** The suggested brain path for a bucket + entry: `<bucket-dir>/<YYYY-MM-DD>-<slug>.md`. */
export function suggestedTargetPath(bucket: TriageBucket, entry: InboxEntry): string {
  const date = entry.ts.slice(0, 10);
  const slug = slugify(entry.title || entry.content, "capture");
  return `${TRIAGE_BUCKET_DIRS[bucket]}/${date}-${slug}.md`;
}

// ── Owner enumeration ─────────────────────────────────────────────────────────────

export type TriageOwner = {
  id: string;
  brain_repo: string;
  github_token: string;
  anthropic_api_key: string;
};

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
 * Every owner the triage sweep can run for: a brain repo, a GitHub token to read/write it, and an
 * Anthropic key to classify with. Owners missing any of the three can't be triaged, so they're
 * filtered out at the query. Bounded by `limit` (the cron is a backstop, not a fan-out).
 */
export async function fetchTriageOwners(limit = 500): Promise<TriageOwner[]> {
  const env = paEnv();
  if (!env) return [];
  const res = await fetch(
    `${env.url}/rest/v1/pocket_agent_users` +
      `?select=id,brain_repo,github_token,anthropic_api_key` +
      `&brain_repo=not.is.null&github_token=not.is.null&anthropic_api_key=not.is.null` +
      `&limit=${limit}`,
    { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` }, cache: "no-store" },
  );
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{
    id: string;
    brain_repo: string | null;
    github_token: string | null;
    anthropic_api_key: string | null;
  }>;
  return rows
    .filter(
      (r): r is TriageOwner =>
        Boolean(r.id) && Boolean(r.brain_repo) && Boolean(r.github_token) && Boolean(r.anthropic_api_key),
    )
    .map((r) => ({
      id: r.id,
      brain_repo: r.brain_repo,
      github_token: r.github_token,
      anthropic_api_key: r.anthropic_api_key,
    }));
}

// ── The per-owner sweep ─────────────────────────────────────────────────────────────

export type TriageSweepResult = { entriesSeen: number; staged: number; skipped: number };

/**
 * Run the triage sweep for one owner: read the unfiled inbox entries, skip any an earlier sweep has
 * already proposed (by entry id, regardless of how that proposal was resolved — a rejected proposal
 * means the owner said "leave it"), classify the rest, and stage one capture_triage_proposal per
 * entry. Returns counts. A per-entry failure is isolated — it's counted as skipped, never thrown.
 */
export async function runTriageForOwner(owner: TriageOwner): Promise<TriageSweepResult> {
  const inboxRaw = await fetchFileContent(owner.brain_repo, INBOX_PATH, owner.github_token);
  if (!inboxRaw) return { entriesSeen: 0, staged: 0, skipped: 0 };

  // Only block-form entries (PA-INBOX blocks with a stable uuid id) are triageable — the file-backed
  // share-sheet / voice-memo entries are their own files and aren't part of memory/inbox.md.
  const entries = parseInboxForDisplay(inboxRaw).filter((e) => !e.path);
  if (entries.length === 0) return { entriesSeen: 0, staged: 0, skipped: 0 };

  // Dedup against entries already proposed (any status — pending, approved, or rejected).
  const alreadyProposed = new Set<string>();
  const existing = await listInboxItems(owner.id);
  if (existing.ok) {
    for (const item of existing.data) {
      if (item.kind !== CAPTURE_TRIAGE_PROPOSAL_KIND) continue;
      const entryId = item.payload?.entryId;
      if (typeof entryId === "string") alreadyProposed.add(entryId);
    }
  }

  let staged = 0;
  let skipped = 0;
  for (const entry of entries) {
    if (alreadyProposed.has(entry.id)) {
      skipped++;
      continue;
    }

    const bucket = await classifyTriageBucket({
      apiKey: owner.anthropic_api_key,
      entry,
      cost: {
        ownerId: owner.id,
        featureSlug: "capture_triage",
        idempotencyKey: `triage:${entry.id}`,
      },
    });
    const targetPath = suggestedTargetPath(bucket, entry);

    const payload: CaptureTriagePayload = {
      entryId: entry.id,
      bucket,
      targetPath,
      contentPreview: entry.content.slice(0, 280),
      ...(entry.title ? { title: entry.title } : {}),
      ...(entry.sourceUrl ? { sourceUrl: entry.sourceUrl } : {}),
    };

    const created = await createInboxItem({
      userId: owner.id,
      kind: CAPTURE_TRIAGE_PROPOSAL_KIND,
      title: `File this capture: ${entry.title || entry.content.slice(0, 60) || "(note)"}`,
      bodyMd:
        `**Suggested home:** ${TRIAGE_BUCKET_LABELS[bucket]} → \`${targetPath}\`\n\n` +
        `${entry.content.slice(0, 280)}${entry.content.length > 280 ? "…" : ""}`,
      source: "capture-triage",
      payload: payload as unknown as Record<string, unknown>,
    });
    if (created.ok) staged++;
    else skipped++;
  }

  return { entriesSeen: entries.length, staged, skipped };
}

// ── Acceptance (called from the inbox approve route) ─────────────────────────────────

/**
 * Accept a triage proposal: file the entry into the suggested (or owner-edited) brain path, then
 * prune it from memory/inbox.md via the cleanup pass. The owner may override the target path and the
 * bucket from the card before approving. Returns the path written, or a typed error (the entry stays
 * in the inbox on any failure).
 */
export async function acceptTriageProposal(params: {
  ctx: CaptureWriteCtx;
  payload: CaptureTriagePayload;
  overrideTargetPath?: string;
  overrideBucket?: TriageBucket;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { ctx, payload } = params;
  const bucket = params.overrideBucket ?? payload.bucket;
  const targetPath = (params.overrideTargetPath ?? payload.targetPath).trim();
  if (!targetPath) return { ok: false, error: "A target path is required to file this capture." };

  const inboxRaw = await fetchFileContent(ctx.repo, INBOX_PATH, ctx.token);
  if (!inboxRaw.trim()) return { ok: false, error: "Couldn't read your inbox to file this." };

  const entry = parseInboxForDisplay(inboxRaw).find((e) => e.id === payload.entryId);
  if (!entry) {
    // The entry is already gone (filed by another path). Treat as a benign no-op success.
    return { ok: true, path: payload.targetPath };
  }

  const write = await writeCaptureNote({ ctx, entry, targetPath, routedBy: "triage", bucket });
  if (!write.ok) return { ok: false, error: write.error };

  // Confirm-and-prune. A failed prune is non-fatal — the note is already written; the entry just
  // lingers in the inbox until the next cleanup trigger re-reads and removes it.
  await pruneInboxEntry({
    ctx,
    entryId: entry.id,
    targets: [{ path: write.path, requireSignature: true }],
  });

  return { ok: true, path: write.path };
}
