// types.ts — the partition/tier domain types for Persona Memory Partitions (PA-MEM-1).
//
// Five partitions × three tiers, the cut the SPEC borrows from Wayland's cognitive memory
// (pattern borrowed, code not). Internal partition names stay engineer-legible; the
// owner-facing surface relabels them (§4.1). Everything here is pure data + Zod — no I/O.

import { z } from "zod";

// ── Partitions (internal names) ───────────────────────────────────────────────────────
export const MEMORY_PARTITIONS = [
  "working",
  "episodic",
  "semantic",
  "procedural",
  "model_of_you",
] as const;
export type MemoryPartition = (typeof MEMORY_PARTITIONS)[number];

export function isMemoryPartition(v: string): v is MemoryPartition {
  return (MEMORY_PARTITIONS as readonly string[]).includes(v);
}

// Owner-facing labels (SPEC §4.1). The internal names never reach the customer surface.
export const PARTITION_LABELS: Record<MemoryPartition, string> = {
  working: "What you're working on",
  episodic: "Past conversations",
  semantic: "What it learned",
  procedural: "What works for you",
  model_of_you: "How you work",
};

// A one-line description per partition for the accordion subheads (plain English, no jargon).
export const PARTITION_BLURBS: Record<MemoryPartition, string> = {
  working: "The thread it's holding right now — what you're in the middle of.",
  episodic: "What past conversations covered, and what got decided.",
  semantic: "Facts it picked up that aren't in your brain yet — a preference, a quirk, an objection.",
  procedural: "Moves that worked — its playbook for how you like things done.",
  model_of_you: "How you talk and decide, so it sounds like your side of the desk.",
};

// ── Tiers (scope) ─────────────────────────────────────────────────────────────────────
export const MEMORY_TIERS = ["session", "persona", "global"] as const;
export type MemoryTier = (typeof MEMORY_TIERS)[number];

export function isMemoryTier(v: string): v is MemoryTier {
  return (MEMORY_TIERS as readonly string[]).includes(v);
}

export const TIER_LABELS: Record<MemoryTier, string> = {
  session: "This conversation",
  persona: "This assistant",
  global: "Everywhere",
};

// ── Row shape (mirrors migration 073) ───────────────────────────────────────────────────
export type PersonaMemoryRow = {
  id: string;
  owner_id: string;
  persona_id: string;
  partition: MemoryPartition;
  tier: MemoryTier;
  conversation_id: string | null;
  body: string;
  importance: number;
  contact_ref: string | null;
  untrusted_origin: boolean;
  source_event_id: string | null;
  superseded_by: string | null;
  created_at: string;
  last_read_at: string | null;
};

// ── Importance ──────────────────────────────────────────────────────────────────────────

export const MIN_IMPORTANCE = 1;
export const MAX_IMPORTANCE = 10;
// At/above this, a trusted write auto-fires; below it stages for owner approval (SPEC §6).
export const AUTO_FIRE_IMPORTANCE = 8;

/** Clamp any number into the legal 1..10 importance band. The LEARN classifier — never the visitor —
 *  owns this value; clamping here is the structural backstop against importance-inflation injection. */
export function clampImportance(n: number): number {
  if (!Number.isFinite(n)) return 5;
  return Math.max(MIN_IMPORTANCE, Math.min(MAX_IMPORTANCE, Math.round(n)));
}

// ── Write candidate (the LEARN-phase structured proposal, SPEC §6) ──────────────────────
// A memory write candidate is {partition, tier, body, importance}. `untrustedOrigin` rides
// alongside so a share_extension capture can never auto-fire. `contactRef` powers the
// "what it learned about [Contact]" filter when the memory is about a named person.
export const MemoryCandidateSchema = z.object({
  partition: z.enum(MEMORY_PARTITIONS),
  tier: z.enum(MEMORY_TIERS),
  body: z.string().trim().min(1).max(2_000),
  importance: z.number().int().min(MIN_IMPORTANCE).max(MAX_IMPORTANCE),
  contactRef: z.string().trim().max(120).optional(),
});
export type MemoryCandidate = z.infer<typeof MemoryCandidateSchema>;

// The LEARN classifier may return zero or more candidates, or decline. Capped so a single turn
// can't flood the queue (over-eager writes are the failure mode to avoid, same as Skills).
export const MEMORY_CANDIDATES_PER_TURN = 3;
export const MemoryLearnDecisionSchema = z.object({
  candidates: z.array(MemoryCandidateSchema).max(MEMORY_CANDIDATES_PER_TURN).default([]),
});
export type MemoryLearnDecision = z.infer<typeof MemoryLearnDecisionSchema>;

// ── Origin (trust bar) ──────────────────────────────────────────────────────────────────
// 'conversation' is an ordinary owner-mode turn. 'share_extension' is a capture forwarded through
// the share extension — untrusted, so it never auto-fires (SPEC §10).
export type MemoryOrigin = "conversation" | "share_extension";

export function isUntrustedOrigin(origin: MemoryOrigin): boolean {
  return origin === "share_extension";
}
