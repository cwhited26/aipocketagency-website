// draft.test.ts — the three-draft generator (SPEC §4.4, §11): connection-note ≤300 chars, the
// two-strike voice retry, and no-slop output. Fully mocked LLM — zero live network.

import { describe, it, expect, vi } from "vitest";
import { generateDraft, buildDraftPrompt, clampConnectionNote, generateAllDrafts } from "../draft";
import type { CompleteFn } from "../llm";
import type { DraftInput } from "../draft";
import { CONNECTION_NOTE_MAX_CHARS } from "../types";

const base: Omit<DraftInput, "kind"> = {
  fullName: "Dana Reeves",
  headline: "VP Marketing at Northwind",
  company: "Northwind",
  brief: "Runs marketing at Northwind. Just moved from a bigger shop. Posts about outbound.",
  signals: { title: "VP Marketing", recentJobMove: true },
  brainContext: "",
};

/** A fake LLM that returns the given texts in order. */
function scriptedLlm(...texts: string[]): CompleteFn {
  let i = 0;
  return vi.fn(async () => {
    const text = texts[Math.min(i, texts.length - 1)];
    i += 1;
    return { ok: true as const, text };
  });
}

describe("buildDraftPrompt", () => {
  it("puts the 300-char cap in the connection-note prompt", () => {
    const { system } = buildDraftPrompt({ ...base, kind: "connection_note" });
    expect(system).toMatch(/300/);
  });

  it("adds the extra avoid-list on the retry", () => {
    const { system } = buildDraftPrompt({ ...base, kind: "day3_inmail" }, "leverage");
    expect(system).toMatch(/AVOID especially/);
    expect(system).toMatch(/leverage/);
  });
});

describe("clampConnectionNote", () => {
  it("leaves non-connection-note kinds untouched", () => {
    const long = "x".repeat(500);
    expect(clampConnectionNote("day3_inmail", long)).toEqual({ text: long, clamped: false });
  });

  it("clamps an over-length connection note to <= 300 chars without cutting a word", () => {
    const long =
      "Congrats on the new role leading marketing at Northwind. " +
      "I build the outbound tooling teams like yours run on and would value comparing notes on what is working for you right now in a fast growing market segment. ".repeat(
        3,
      );
    const { text, clamped } = clampConnectionNote("connection_note", long);
    expect(clamped).toBe(true);
    expect(text.length).toBeLessThanOrEqual(CONNECTION_NOTE_MAX_CHARS);
    expect(text.endsWith(" ")).toBe(false);
  });
});

describe("generateDraft two-strike voice retry", () => {
  it("returns the clean retry when the first draft trips a voice rule", async () => {
    const llm = scriptedLlm(
      "Let's leverage synergies to unlock growth.", // strike 1: slop
      "Saw you just took over marketing at Northwind. Worth a quick chat about outbound?", // strike 2: clean
    );
    const out = await generateDraft({ ...base, kind: "day3_inmail" }, llm, {
      ownerId: "u1",
      idempotencyKey: "k",
    });
    expect(out.voiceFlags).toBe("");
    expect(out.body).toMatch(/Northwind/);
    expect(llm).toHaveBeenCalledTimes(2);
  });

  it("stages with a voice_warning when both strikes trip a rule", async () => {
    const llm = scriptedLlm(
      "Let's leverage synergies.",
      "We empower teams to unlock world-class growth.",
    );
    const out = await generateDraft({ ...base, kind: "day3_inmail" }, llm, {
      ownerId: "u1",
      idempotencyKey: "k",
    });
    expect(out.voiceFlags).toMatch(/voice_warning/);
  });

  it("does not retry when the first draft is already clean", async () => {
    const llm = scriptedLlm("Congrats on the move to Northwind — worth comparing notes on outbound?");
    const out = await generateDraft({ ...base, kind: "connection_note" }, llm, {
      ownerId: "u1",
      idempotencyKey: "k",
    });
    expect(out.voiceFlags).toBe("");
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it("enforces the 300-char cap on the connection note and flags the clamp", async () => {
    const overLong = "Congrats on the new marketing role at Northwind. ".repeat(10); // ~490 chars, clean voice
    const llm = scriptedLlm(overLong);
    const out = await generateDraft({ ...base, kind: "connection_note" }, llm, {
      ownerId: "u1",
      idempotencyKey: "k",
    });
    expect(out.body.length).toBeLessThanOrEqual(CONNECTION_NOTE_MAX_CHARS);
    expect(out.voiceFlags).toMatch(/clamped_to_300/);
  });

  it("returns an empty flagged body when the model is unavailable", async () => {
    const llm: CompleteFn = vi.fn(async () => ({ ok: false as const, error: "boom" }));
    const out = await generateDraft({ ...base, kind: "day7_followup" }, llm, {
      ownerId: "u1",
      idempotencyKey: "k",
    });
    expect(out.body).toBe("");
    expect(out.voiceFlags).toMatch(/draft_failed/);
  });
});

describe("generateAllDrafts", () => {
  it("produces all three kinds", async () => {
    const llm = scriptedLlm("Congrats on the move to Northwind — worth a quick chat?");
    const out = await generateAllDrafts(base, llm, { ownerId: "u1", prospectId: "p1" });
    expect(out.map((d) => d.kind)).toEqual(["connection_note", "day3_inmail", "day7_followup"]);
  });
});
