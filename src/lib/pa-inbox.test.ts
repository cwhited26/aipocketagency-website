import { describe, it, expect } from "vitest";
import {
  appendEntryToRaw,
  parseInboxForDisplay,
  removeEntryFromRaw,
  softDeleteEntryInRaw,
  setEntryTagsInRaw,
  normalizeTags,
  isDeleted,
} from "@/lib/pa-inbox";

// Build a two-entry inbox file and return the raw content + both ids.
function seed(): { raw: string; first: string; second: string } {
  const a = appendEntryToRaw("", { kind: "note", content: "first note", source: "sms" });
  const b = appendEntryToRaw(a.content, { kind: "url", content: "https://x.dev", title: "Link" });
  return { raw: b.content, first: a.entry.id, second: b.entry.id };
}

describe("normalizeTags", () => {
  it("trims, drops blanks, dedupes case-insensitively, clamps length and count", () => {
    expect(normalizeTags(["  Work ", "work", "", "WORK"])).toEqual(["Work"]);
    expect(normalizeTags(["a".repeat(80)])[0]).toHaveLength(40);
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(20);
  });
});

describe("parse round-trip with tags + deletedAt", () => {
  it("persists tags through a write/read cycle", () => {
    const { raw, first } = seed();
    const updated = setEntryTagsInRaw(raw, first, ["work", "idea"]);
    const entries = parseInboxForDisplay(updated);
    const target = entries.find((e) => e.id === first);
    expect(target?.tags).toEqual(["work", "idea"]);
  });

  it("clearing tags removes the field", () => {
    const { raw, first } = seed();
    const tagged = setEntryTagsInRaw(raw, first, ["work"]);
    const cleared = setEntryTagsInRaw(tagged, first, []);
    const target = parseInboxForDisplay(cleared).find((e) => e.id === first);
    expect(target?.tags).toBeUndefined();
  });
});

describe("softDeleteEntryInRaw", () => {
  it("stamps deletedAt but KEEPS the block in the file (brain history preserved)", () => {
    const { raw, first } = seed();
    const updated = softDeleteEntryInRaw(raw, first, "2026-06-23T13:00:00.000Z");

    // The entry still parses out of the file...
    const entries = parseInboxForDisplay(updated);
    expect(entries).toHaveLength(2);
    const target = entries.find((e) => e.id === first);
    expect(target?.deletedAt).toBe("2026-06-23T13:00:00.000Z");
    expect(isDeleted(target!)).toBe(true);

    // ...and the other entry is untouched.
    const other = entries.find((e) => e.id !== first);
    expect(other?.deletedAt).toBeUndefined();

    // The raw still contains the original content (not erased).
    expect(updated).toContain("first note");
  });

  it("is idempotent — a re-delete keeps the first tombstone time", () => {
    const { raw, first } = seed();
    const once = softDeleteEntryInRaw(raw, first, "2026-06-23T13:00:00.000Z");
    const twice = softDeleteEntryInRaw(once, first, "2026-06-23T14:00:00.000Z");
    const target = parseInboxForDisplay(twice).find((e) => e.id === first);
    expect(target?.deletedAt).toBe("2026-06-23T13:00:00.000Z");
  });

  it("a missing id leaves entries intact", () => {
    const { raw } = seed();
    const updated = softDeleteEntryInRaw(raw, "00000000-0000-0000-0000-000000000000", "2026-06-23T13:00:00.000Z");
    expect(parseInboxForDisplay(updated).every((e) => !e.deletedAt)).toBe(true);
  });
});

describe("removeEntryFromRaw still hard-deletes", () => {
  it("drops the block entirely", () => {
    const { raw, first } = seed();
    const updated = removeEntryFromRaw(raw, first);
    const entries = parseInboxForDisplay(updated);
    expect(entries).toHaveLength(1);
    expect(entries.find((e) => e.id === first)).toBeUndefined();
  });
});
