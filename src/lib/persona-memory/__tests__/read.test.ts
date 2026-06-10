import { describe, it, expect, vi } from "vitest";
import { filterToPersona } from "../read";
import type { PersonaMemoryRow } from "../types";

function row(personaId: string, id: string): PersonaMemoryRow {
  return {
    id,
    owner_id: "owner",
    persona_id: personaId,
    partition: "semantic",
    tier: "persona",
    conversation_id: null,
    body: "secret",
    importance: 9,
    contact_ref: null,
    untrusted_origin: false,
    source_event_id: null,
    superseded_by: null,
    created_at: "2026-06-01T00:00:00Z",
    last_read_at: null,
  };
}

describe("filterToPersona (ContainmentGuard belt, SPEC §10)", () => {
  it("keeps only the queried persona's memories and drops any cross-persona row", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mixed = [row("sales", "a"), row("admin", "b"), row("sales", "c")];
    const kept = filterToPersona(mixed, "sales");
    expect(kept.map((r) => r.id)).toEqual(["a", "c"]);
    // the leaked row is loudly logged, never silently passed
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns everything when all rows belong to the persona", () => {
    expect(filterToPersona([row("sales", "a"), row("sales", "b")], "sales")).toHaveLength(2);
  });
});
