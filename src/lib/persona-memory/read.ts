// read.ts — the RAG cascade read path (SPEC §7). Before a Persona plans a response, this loads its
// live memories, ranks them (cascade.ts), caps to ~2k tokens, and renders the `## Your memory of this
// owner` block its system prompt carries. Additive to the brain RAG path — it doesn't touch it.
//
// Two hard guards live here:
//   1. Public Personas mode NEVER reads memory (SPEC §11) — the public attack surface stays unchanged.
//   2. ContainmentGuard scope (SPEC §10) — every memory loaded must belong to THIS persona. The DB
//      query already filters by persona_id; filterToPersona is the belt that drops any row that
//      somehow escaped, so a Sales Assistant write can never load into Admin Assistant context.

import { isPublicMode, type PersonaMode } from "@/lib/personas/types";
import { listLiveForPersona } from "./db";
import { buildMemoryBlock, rankMemories, selectWithinBudget } from "./cascade";
import type { PersonaMemoryRow } from "./types";

// Structured logger — JSON per line, never console.log, mirrors rag/log.ts.
function memLog(level: "info" | "warn" | "error", msg: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "persona-memory",
    level,
    msg,
    ...(fields ?? {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/**
 * Belt-and-suspenders ContainmentGuard: keep only memories that belong to `personaId`. The DB query
 * is the structural enforcement; this catches (and loudly logs) any row that escaped it so a leak
 * degrades to "dropped + alarmed" rather than "leaked into the prompt". Pure — unit-tested.
 */
export function filterToPersona(
  memories: readonly PersonaMemoryRow[],
  personaId: string,
): PersonaMemoryRow[] {
  const kept: PersonaMemoryRow[] = [];
  for (const m of memories) {
    if (m.persona_id === personaId) kept.push(m);
    else memLog("error", "containment: dropped cross-persona memory at read", {
      personaId,
      leakedFrom: m.persona_id,
      memoryId: m.id,
    });
  }
  return kept;
}

export type LoadMemoryResult = {
  /** The `## Your memory of this owner` block, or "" when there's nothing (or public mode). */
  block: string;
  /** How many memories made it into the block (after cascade + budget). */
  used: number;
};

const EMPTY: LoadMemoryResult = { block: "", used: 0 };

/**
 * Loads the memory block for a persona conversation. Returns an empty block — never reads a row —
 * when the persona is in a public/widget mode (SPEC §11). Best-effort: any DB failure degrades to an
 * empty block so a memory outage never breaks the chat.
 */
export async function loadPersonaMemory(input: {
  personaId: string;
  mode: PersonaMode;
}): Promise<LoadMemoryResult> {
  // Hard guard #1: public Personas mode never reads memory.
  if (isPublicMode(input.mode)) return EMPTY;

  const res = await listLiveForPersona(input.personaId);
  if (!res.ok) {
    memLog("warn", "memory read failed; degrading to empty block", {
      personaId: input.personaId,
      error: res.error,
    });
    return EMPTY;
  }

  // Hard guard #2: ContainmentGuard — only this persona's memories.
  const scoped = filterToPersona(res.data, input.personaId);
  if (scoped.length === 0) return EMPTY;

  const selected = selectWithinBudget(rankMemories(scoped));
  return { block: buildMemoryBlock(selected), used: selected.length };
}
