// soul-load.ts — the runtime read path (SPEC §How Soul gets used at runtime). Before a Persona
// generates a response, this loads its active Soul attributes (confidence > 0.4, not superseded) and
// renders the `## How [Owner] prefers to be worked with` block its system prompt carries — alongside
// the Persona's Identity (spec) and the persona-memory block.
//
// Two guards mirror persona-memory/read.ts:
//   1. Public/widget Personas never load a Soul (SPEC §Privacy + safety — Soul only loads into the
//      Persona's OWN private system prompt, never a customer-facing surface).
//   2. ContainmentGuard scope: every attribute must belong to THIS persona. The DB query filters by
//      persona_id; filterToPersona is the belt that drops (and loudly logs) any row that escaped.

import { isPublicMode, type PersonaMode } from "./types";
import { listLiveForPersona } from "./soul-db";
import {
  SOUL_BLOCK_KIND_ORDER,
  SOUL_KIND_LABELS,
  SOUL_READ_MIN_CONFIDENCE,
  type SoulAttributeKind,
  type SoulAttributeRow,
} from "./soul-types";

// Structured logger — JSON per line, never console.log, mirrors persona-memory/read.ts.
function soulLog(level: "info" | "warn" | "error", msg: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope: "persona-soul",
    level,
    msg,
    ...(fields ?? {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Belt-and-suspenders ContainmentGuard: keep only attributes that belong to `personaId`. The DB
 *  query is the structural enforcement; this catches (and alarms on) any row that escaped it. Pure. */
export function filterToPersona(
  attributes: readonly SoulAttributeRow[],
  personaId: string,
): SoulAttributeRow[] {
  const kept: SoulAttributeRow[] = [];
  for (const a of attributes) {
    if (a.persona_id === personaId) kept.push(a);
    else
      soulLog("error", "containment: dropped cross-persona soul attribute at read", {
        personaId,
        leakedFrom: a.persona_id,
        soulId: a.id,
      });
  }
  return kept;
}

/** Keep only attributes that clear the runtime confidence floor (SPEC §How Soul gets used: > 0.4). */
export function selectActiveAttributes(
  attributes: readonly SoulAttributeRow[],
): SoulAttributeRow[] {
  return attributes.filter((a) => a.confidence > SOUL_READ_MIN_CONFIDENCE);
}

/**
 * Renders the `## How [Owner] prefers to be worked with` block from active attributes, grouped by
 * kind in SOUL_BLOCK_KIND_ORDER (boundaries last, marked do-not-violate). Returns "" when there's
 * nothing to say — the caller omits the section entirely. Pure + unit-tested.
 */
export function buildSoulBlock(
  attributes: readonly SoulAttributeRow[],
  ownerLabel = "this owner",
): string {
  const active = selectActiveAttributes(attributes);
  if (active.length === 0) return "";

  const byKind = new Map<SoulAttributeKind, SoulAttributeRow[]>();
  for (const a of active) {
    const list = byKind.get(a.attribute_kind) ?? [];
    list.push(a);
    byKind.set(a.attribute_kind, list);
  }

  const lines: string[] = [`## How ${ownerLabel} prefers to be worked with`];
  lines.push(
    "What you've learned about how this owner likes to be worked with — their style, not their facts. Apply it the way a colleague who knows them would. Treat anything under Boundaries as a hard rule.",
  );
  for (const kind of SOUL_BLOCK_KIND_ORDER) {
    const rows = byKind.get(kind);
    if (!rows || rows.length === 0) continue;
    lines.push("", `${SOUL_KIND_LABELS[kind]}:`);
    for (const r of rows) lines.push(`- ${r.attribute_summary.trim()}`);
  }
  return lines.join("\n");
}

export type LoadSoulResult = {
  /** The `## How [Owner] prefers to be worked with` block, or "" when empty/public-mode. */
  block: string;
  /** How many attributes made it into the block (after the confidence floor). */
  used: number;
};

const EMPTY: LoadSoulResult = { block: "", used: 0 };

/**
 * Loads the Soul block for a persona conversation. Returns an empty block — never reads a row — when
 * the persona is in a public/widget mode (SPEC §Privacy). Best-effort: any DB failure degrades to an
 * empty block so a Soul outage never breaks the chat.
 */
export async function loadPersonaSoul(input: {
  personaId: string;
  mode: PersonaMode;
  ownerLabel?: string;
}): Promise<LoadSoulResult> {
  if (isPublicMode(input.mode)) return EMPTY;

  const res = await listLiveForPersona(input.personaId);
  if (!res.ok) {
    soulLog("warn", "soul read failed; degrading to empty block", {
      personaId: input.personaId,
      error: res.error,
    });
    return EMPTY;
  }

  const scoped = filterToPersona(res.data, input.personaId);
  const active = selectActiveAttributes(scoped);
  if (active.length === 0) return EMPTY;

  return { block: buildSoulBlock(active, input.ownerLabel), used: active.length };
}
