import { describe, it, expect } from "vitest";
import {
  appendEntryToRaw,
  parseInboxForDisplay,
  removeEntryFromRaw,
  softDeleteEntryInRaw,
  setEntryTagsInRaw,
  normalizeTags,
  isDeleted,
  parseVoiceMemoFile,
  parseShareSheetFile,
  upsertFrontmatter,
  setFileDeletedAt,
  setFileTags,
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

describe("file-backed capture frontmatter parsing", () => {
  const VOICE_PATH = "inbox/voice-memos/2026-06-23/120000-idea.md";

  it("reads tags + deleted_at from a voice memo's frontmatter", () => {
    const raw = [
      "---",
      "captured_at: 2026-06-23T12:00:00",
      "source: voice-memo",
      "topic: Pricing idea",
      "tags: pricing, launch",
      "deleted_at: 2026-06-23T13:00:00.000Z",
      "---",
      "",
      "Raise the floor to 97.",
    ].join("\n");
    const entry = parseVoiceMemoFile(VOICE_PATH, raw);
    expect(entry).not.toBeNull();
    expect(entry?.tags).toEqual(["pricing", "launch"]);
    expect(entry?.deletedAt).toBe("2026-06-23T13:00:00.000Z");
    expect(entry?.kind).toBe("voice");
    expect(isDeleted(entry!)).toBe(true);
  });

  it("a memo with no tags/deleted_at omits those fields", () => {
    const raw = "---\ncaptured_at: 2026-06-23T12:00:00\nsource: voice-memo\n---\n\nJust a note.";
    const entry = parseVoiceMemoFile(VOICE_PATH, raw);
    expect(entry?.tags).toBeUndefined();
    expect(entry?.deletedAt).toBeUndefined();
  });

  it("reads bracketed/quoted tags from a share file", () => {
    const raw = "---\ncaptured_at: 2026-06-02-160956\ntag: A link\ntags: [\"a\", b]\n---\n\nURL: https://x.dev\n";
    const entry = parseShareSheetFile("sessions/inbox/share-x.md", raw);
    expect(entry?.tags).toEqual(["a", "b"]);
  });
});

describe("upsertFrontmatter", () => {
  it("adds a key to a file that has frontmatter, preserving body + order", () => {
    const raw = "---\ntopic: Idea\n---\n\nbody text";
    const out = upsertFrontmatter(raw, { tags: "a, b" });
    expect(out).toBe("---\ntopic: Idea\ntags: a, b\n---\n\nbody text");
  });

  it("creates a frontmatter block when the file has none", () => {
    const out = upsertFrontmatter("just a body", { deleted_at: "2026-06-23T13:00:00.000Z" });
    expect(out).toBe("---\ndeleted_at: 2026-06-23T13:00:00.000Z\n---\n\njust a body");
  });

  it("removes a key when the value is null or empty", () => {
    const raw = "---\ntopic: Idea\ntags: a, b\n---\n\nbody";
    expect(upsertFrontmatter(raw, { tags: null })).toBe("---\ntopic: Idea\n---\n\nbody");
  });

  it("dropping the only key leaves just the body", () => {
    const raw = "---\ntags: a\n---\n\nbody";
    expect(upsertFrontmatter(raw, { tags: null })).toBe("body");
  });
});

describe("setFileDeletedAt / setFileTags round-trip through the parser", () => {
  const PATH = "inbox/voice-memos/2026-06-23/120000-idea.md";
  const base = "---\ncaptured_at: 2026-06-23T12:00:00\nsource: voice-memo\n---\n\nSpoken note.";

  it("soft-delete is idempotent and visible to the parser", () => {
    const once = setFileDeletedAt(base, "2026-06-23T13:00:00.000Z");
    const twice = setFileDeletedAt(once, "2026-06-23T14:00:00.000Z");
    // Re-stamp keeps the original time.
    expect(parseVoiceMemoFile(PATH, twice)?.deletedAt).toBe("2026-06-23T13:00:00.000Z");
  });

  it("tags write + clear via frontmatter", () => {
    const tagged = setFileTags(base, ["Pricing", "pricing", "launch"]);
    expect(parseVoiceMemoFile(PATH, tagged)?.tags).toEqual(["Pricing", "launch"]);
    const cleared = setFileTags(tagged, []);
    expect(parseVoiceMemoFile(PATH, cleared)?.tags).toBeUndefined();
  });
});
