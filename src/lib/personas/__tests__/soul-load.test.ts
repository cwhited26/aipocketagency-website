import { describe, it, expect } from "vitest";
import { buildSoulBlock, selectActiveAttributes, filterToPersona } from "../soul-load";
import { SOUL_READ_MIN_CONFIDENCE, type SoulAttributeRow, type SoulAttributeKind } from "../soul-types";

function row(p: Partial<SoulAttributeRow> & { kind?: SoulAttributeKind }): SoulAttributeRow {
  return {
    id: p.id ?? "s1",
    persona_id: p.persona_id ?? "pa",
    owner_id: p.owner_id ?? "owner",
    attribute_kind: p.kind ?? p.attribute_kind ?? "communication_style",
    attribute_summary: p.attribute_summary ?? "Prefers terse replies",
    attribute_body: p.attribute_body ?? null,
    confidence: p.confidence ?? 0.7,
    source_session_id: p.source_session_id ?? null,
    locked: p.locked ?? false,
    superseded_by: p.superseded_by ?? null,
    created_at: p.created_at ?? "2026-06-01T00:00:00Z",
    updated_at: p.updated_at ?? "2026-06-01T00:00:00Z",
  };
}

describe("selectActiveAttributes", () => {
  it("keeps only attributes above the read floor (> 0.4)", () => {
    const rows = [
      row({ id: "keep", confidence: SOUL_READ_MIN_CONFIDENCE + 0.01 }),
      row({ id: "drop", confidence: SOUL_READ_MIN_CONFIDENCE }), // exactly 0.4 → excluded (strict >)
      row({ id: "drop2", confidence: 0.2 }),
    ];
    const active = selectActiveAttributes(rows);
    expect(active.map((a) => a.id)).toEqual(["keep"]);
  });
});

describe("filterToPersona", () => {
  it("drops rows that belong to a different persona", () => {
    const kept = filterToPersona(
      [row({ id: "mine", persona_id: "pa" }), row({ id: "leak", persona_id: "other" })],
      "pa",
    );
    expect(kept.map((a) => a.id)).toEqual(["mine"]);
  });
});

describe("buildSoulBlock", () => {
  it("returns empty string when there's nothing active", () => {
    expect(buildSoulBlock([])).toBe("");
    expect(buildSoulBlock([row({ confidence: 0.1 })])).toBe("");
  });

  it("renders the SPEC header and groups by kind with boundaries last", () => {
    const block = buildSoulBlock(
      [
        row({ id: "1", kind: "communication_style", attribute_summary: "Casual and direct" }),
        row({ id: "2", kind: "boundary", attribute_summary: "Never auto-send without review" }),
        row({ id: "3", kind: "response_preference", attribute_summary: "Bullets over prose" }),
      ],
      "Chase",
    );
    expect(block).toContain("## How Chase prefers to be worked with");
    expect(block).toContain("Communication style:");
    expect(block).toContain("- Casual and direct");
    expect(block).toContain("Boundaries (do not violate):");
    // boundary heading must come AFTER communication style + response preferences (match the headings
    // with their colons, since the intro paragraph also mentions the word "Boundaries")
    expect(block.indexOf("Boundaries (do not violate):")).toBeGreaterThan(
      block.indexOf("Communication style:"),
    );
    expect(block.indexOf("Boundaries (do not violate):")).toBeGreaterThan(
      block.indexOf("Response preferences:"),
    );
  });

  it("defaults the owner label when none is supplied", () => {
    const block = buildSoulBlock([row({})]);
    expect(block).toContain("## How this owner prefers to be worked with");
  });
});
