// prune.ts — the supersede-on-overflow pruner (SPEC §9, PA-MEM-6). Pure selection; the DB write
// (superseding the victim, inserting the new memory) is orchestrated in write.ts.
//
// The tier cap counts LIVE memories only (superseded rows never count). When a write would push an
// owner past their cap, the lowest-importance live memory auto-supersedes to make room — a bounded
// Postgres footprint without a hard-error UX. Tie-break on overflow: the oldest loses.

import type { PersonaMemoryRow } from "./types";

/** True when `liveCount` is at/over `cap`. A null cap means unlimited (enterprise) — never over. */
export function isOverCap(liveCount: number, cap: number | null): boolean {
  if (cap === null) return false;
  return liveCount >= cap;
}

/**
 * Picks the memory to supersede when the owner is at their cap and a new write arrives: the
 * lowest-importance live memory, oldest-first on a tie. Returns null when the list is empty (nothing
 * to evict — the caller treats that as "write anyway", which can't happen with a positive cap).
 */
export function selectOverflowVictim(
  live: readonly PersonaMemoryRow[],
): PersonaMemoryRow | null {
  let victim: PersonaMemoryRow | null = null;
  for (const m of live) {
    if (victim === null) {
      victim = m;
      continue;
    }
    if (m.importance < victim.importance) {
      victim = m;
    } else if (m.importance === victim.importance && m.created_at < victim.created_at) {
      victim = m;
    }
  }
  return victim;
}
