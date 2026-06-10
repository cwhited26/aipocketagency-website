// cascade.ts — the read-path ranking (SPEC §7). Pure, unit-tested. The I/O (fetching a persona's
// live memories) lives in read.ts; this file decides ORDER and what fits the budget, and renders the
// `## Your memory of this owner` block the persona's system prompt carries.
//
// Cascade rule (SPEC §7.4): global memories outrank persona memories on tie; recent outranks old at
// the same importance. So the sort is importance desc → tier (global > persona > session) → recency.

import {
  PARTITION_LABELS,
  type MemoryPartition,
  type MemoryTier,
  type PersonaMemoryRow,
} from "./types";

// global outranks persona outranks session on a tie (SPEC §7.4 — global is the owner's identity layer).
const TIER_RANK: Record<MemoryTier, number> = { global: 2, persona: 1, session: 0 };

/** Higher sorts first. global > persona > session. */
export function tierRank(tier: MemoryTier): number {
  return TIER_RANK[tier];
}

/** The cascade comparator: importance, then tier, then recency. Returns <0 when `a` should rank before
 *  `b`. Stable for equal rows (same importance/tier/time → original order preserved by Array.sort). */
export function compareForCascade(a: PersonaMemoryRow, b: PersonaMemoryRow): number {
  if (a.importance !== b.importance) return b.importance - a.importance;
  const tr = tierRank(b.tier) - tierRank(a.tier);
  if (tr !== 0) return tr;
  // Recent outranks old. Lexicographic ISO compare is a valid chronological compare.
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return 0;
}

/** Returns a new array of the live memories in cascade order. Does not mutate the input. */
export function rankMemories(memories: readonly PersonaMemoryRow[]): PersonaMemoryRow[] {
  return [...memories].sort(compareForCascade);
}

// ── Token budgeting (SPEC §7.5: cap at ~2k tokens of memory context) ────────────────────
// We don't tokenize for real here — a 4-chars-per-token heuristic is plenty to keep the block bounded
// and deterministic. The block ALSO carries per-partition headings; we budget the bodies, which
// dominate, and leave a fixed headroom for headings.
export const MEMORY_TOKEN_BUDGET = 2_000;
const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Greedily take ranked memories until the next one would blow the token budget, then stop. Because the
 * input is already cascade-ranked, the most important memories are kept and the marginal ones drop —
 * the cap never silently truncates a high-importance memory in favor of a low one.
 */
export function selectWithinBudget(
  ranked: readonly PersonaMemoryRow[],
  budget: number = MEMORY_TOKEN_BUDGET,
): PersonaMemoryRow[] {
  const out: PersonaMemoryRow[] = [];
  let spent = 0;
  for (const m of ranked) {
    const cost = estimateTokens(m.body);
    if (spent + cost > budget && out.length > 0) break;
    out.push(m);
    spent += cost;
  }
  return out;
}

// Partition print order for the memory block — what-it-knows-about-you first, voice last.
const BLOCK_PARTITION_ORDER: MemoryPartition[] = [
  "model_of_you",
  "semantic",
  "procedural",
  "episodic",
  "working",
];

/**
 * Renders the `## Your memory of this owner` block from the selected memories. Grouped by partition
 * with the owner-friendly label so the model reads it as plain context, not a database dump. Returns
 * an empty string when there are no memories — the caller omits the section entirely.
 */
export function buildMemoryBlock(memories: readonly PersonaMemoryRow[]): string {
  if (memories.length === 0) return "";
  const byPartition = new Map<MemoryPartition, PersonaMemoryRow[]>();
  for (const m of memories) {
    const list = byPartition.get(m.partition) ?? [];
    list.push(m);
    byPartition.set(m.partition, list);
  }

  const lines: string[] = ["## Your memory of this owner"];
  lines.push(
    "Context you've accumulated working with this owner — on top of their brain, not a replacement for it. Use it the way a colleague who knows them would. Don't quote it back verbatim or claim you were \"trained\" on it.",
  );
  for (const partition of BLOCK_PARTITION_ORDER) {
    const rows = byPartition.get(partition);
    if (!rows || rows.length === 0) continue;
    lines.push("", `### ${PARTITION_LABELS[partition]}`);
    for (const r of rows) lines.push(`- ${r.body.trim()}`);
  }
  return lines.join("\n");
}
