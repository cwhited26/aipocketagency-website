import { describe, it, expect } from "vitest";
import {
  extractSoulObservations,
  selectSoulOverflowVictim,
  isSoulProposalSuppressed,
  type SoulExtractLlm,
} from "../soul-extract";
import { routeByConfidence, type SoulAttributeRow, type SoulAttributeKind, type SoulObservation } from "../soul-types";
import type { InboxItem } from "@/lib/pa-inbox-items";

function llmReturning(text: string): SoulExtractLlm {
  return async () => ({ ok: true, text });
}

function row(p: Partial<SoulAttributeRow> & { kind?: SoulAttributeKind }): SoulAttributeRow {
  return {
    id: p.id ?? "s1",
    persona_id: p.persona_id ?? "pa",
    owner_id: p.owner_id ?? "owner",
    attribute_kind: p.kind ?? p.attribute_kind ?? "response_preference",
    attribute_summary: p.attribute_summary ?? "summary",
    attribute_body: p.attribute_body ?? null,
    confidence: p.confidence ?? 0.7,
    source_session_id: p.source_session_id ?? null,
    locked: p.locked ?? false,
    superseded_by: p.superseded_by ?? null,
    created_at: p.created_at ?? "2026-06-01T00:00:00Z",
    updated_at: p.updated_at ?? "2026-06-01T00:00:00Z",
  };
}

function inbox(p: Partial<InboxItem>): InboxItem {
  return {
    id: p.id ?? "i1",
    user_id: p.user_id ?? "owner",
    kind: p.kind ?? "soul_attribute_proposal",
    title: p.title ?? "t",
    body_md: p.body_md ?? null,
    source: p.source ?? "persona-soul",
    payload: p.payload ?? {},
    status: p.status ?? "pending",
    created_at: p.created_at ?? "2026-06-01T00:00:00Z",
    resolved_at: p.resolved_at ?? null,
    resolved_by: p.resolved_by ?? null,
    expires_at: p.expires_at ?? null,
  };
}

const obs = (p: Partial<SoulObservation>): SoulObservation => ({
  kind: p.kind ?? "communication_style",
  summary: p.summary ?? "Prefers terse replies",
  body: p.body,
  confidence: p.confidence ?? 0.7,
});

describe("routeByConfidence (SPEC thresholds)", () => {
  it("discards below 0.5, proposes 0.5..0.8, auto-writes above 0.8", () => {
    expect(routeByConfidence(0.49)).toBe("discard");
    expect(routeByConfidence(0.5)).toBe("propose");
    expect(routeByConfidence(0.8)).toBe("propose");
    expect(routeByConfidence(0.81)).toBe("auto");
  });
});

describe("extractSoulObservations", () => {
  it("parses observations and clamps confidence into [0,1]", async () => {
    const out = await extractSoulObservations(
      { conversation: "x" },
      llmReturning(
        JSON.stringify({
          observations: [{ kind: "boundary", summary: "Always ask before sending", confidence: 1.5 }],
        }),
      ),
    );
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe(1);
    expect(out[0].kind).toBe("boundary");
  });

  it("returns [] for an empty observation list", async () => {
    const out = await extractSoulObservations(
      { conversation: "x" },
      llmReturning(JSON.stringify({ observations: [] })),
    );
    expect(out).toEqual([]);
  });

  it("returns [] on unparseable output (never over-proposes)", async () => {
    const out = await extractSoulObservations({ conversation: "x" }, llmReturning("not json at all"));
    expect(out).toEqual([]);
  });

  it("returns [] when the LLM call fails", async () => {
    const out = await extractSoulObservations({ conversation: "x" }, async () => ({
      ok: false,
      error: "boom",
    }));
    expect(out).toEqual([]);
  });

  it("rejects a malformed observation (bad kind) via Zod → []", async () => {
    const out = await extractSoulObservations(
      { conversation: "x" },
      llmReturning(JSON.stringify({ observations: [{ kind: "nonsense", summary: "x", confidence: 0.6 }] })),
    );
    expect(out).toEqual([]);
  });
});

describe("selectSoulOverflowVictim", () => {
  it("picks the lowest-confidence live attribute, oldest on a tie", () => {
    const victim = selectSoulOverflowVictim([
      row({ id: "a", confidence: 0.9 }),
      row({ id: "b", confidence: 0.5, created_at: "2026-06-05T00:00:00Z" }),
      row({ id: "c", confidence: 0.5, created_at: "2026-06-01T00:00:00Z" }),
    ]);
    expect(victim?.id).toBe("c");
  });
  it("returns null for an empty set", () => {
    expect(selectSoulOverflowVictim([])).toBeNull();
  });
});

describe("isSoulProposalSuppressed", () => {
  it("suppresses an observation already held live", () => {
    const live = [row({ kind: "communication_style", attribute_summary: "Prefers terse replies" })];
    expect(isSoulProposalSuppressed(obs({}), "pa", live, [])).toBe(true);
  });

  it("suppresses an observation already proposed-pending for the same persona", () => {
    const existing = [
      inbox({
        kind: "soul_attribute_proposal",
        status: "pending",
        payload: { personaId: "pa", kind: "communication_style", summary: "Prefers terse replies" },
      }),
    ];
    expect(isSoulProposalSuppressed(obs({}), "pa", [], existing)).toBe(true);
  });

  it("does not suppress a net-new observation", () => {
    expect(isSoulProposalSuppressed(obs({ summary: "Likes a Friday recap" }), "pa", [], [])).toBe(false);
  });

  it("ignores proposals for a different persona", () => {
    const existing = [
      inbox({
        kind: "soul_attribute_proposal",
        status: "pending",
        payload: { personaId: "other", kind: "communication_style", summary: "Prefers terse replies" },
      }),
    ];
    expect(isSoulProposalSuppressed(obs({}), "pa", [], existing)).toBe(false);
  });
});
