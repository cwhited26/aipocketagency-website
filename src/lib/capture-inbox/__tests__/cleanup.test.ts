// Unit tests for the cleanup pass (lib/capture-inbox/cleanup pruneInboxEntry) — the idempotency
// check that makes it conservative: an entry is pruned from memory/inbox.md ONLY after a target path
// is confirmed to hold its content. Missing target, absent signature, an already-pruned entry, and the
// sibling-writer (no-signature) case are all pinned. The brain read/write layer is mocked; the inbox
// parse/serialize is the real pa-inbox code.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pa-brain", () => ({
  fetchFileContent: vi.fn(),
  commitMemoryFile: vi.fn(),
}));

import { commitMemoryFile, fetchFileContent } from "@/lib/pa-brain";
import { appendEntryToRaw } from "@/lib/pa-inbox";
import { captureSignature } from "../types";
import { pruneInboxEntry } from "../cleanup";

const mockFetch = vi.mocked(fetchFileContent);
const mockCommit = vi.mocked(commitMemoryFile);

const ctx = { repo: "owner/brain", token: "tok" };
const TARGET = "brain/competitive/2026-06-09-note.md";

// Build an inbox raw with one entry and return both the raw and the generated entry id.
function buildInbox(content: string): { raw: string; id: string } {
  const { content: raw, entry } = appendEntryToRaw("", { kind: "note", content });
  return { raw, id: entry.id };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCommit.mockResolvedValue({ ok: true, sha: "sha-1" });
});

describe("pruneInboxEntry", () => {
  it("prunes when the target contains the capture signature", async () => {
    const { raw, id } = buildInbox("competitor pricing note");
    const targetContent = `# Note\n\n<!-- ${captureSignature(id)} -->\n`;
    mockFetch.mockImplementation(async (_repo, path) =>
      path === "memory/inbox.md" ? raw : path === TARGET ? targetContent : "",
    );

    const result = await pruneInboxEntry({
      ctx,
      entryId: id,
      targets: [{ path: TARGET, requireSignature: true }],
    });

    expect(result.pruned).toBe(true);
    expect(mockCommit).toHaveBeenCalledTimes(1);
    // The rewritten inbox no longer carries the entry id.
    const written = mockCommit.mock.calls[0][0].content;
    expect(written.includes(id)).toBe(false);
  });

  it("does NOT prune when the target is missing", async () => {
    const { raw, id } = buildInbox("note");
    mockFetch.mockImplementation(async (_repo, path) => (path === "memory/inbox.md" ? raw : ""));

    const result = await pruneInboxEntry({
      ctx,
      entryId: id,
      targets: [{ path: TARGET, requireSignature: true }],
    });

    expect(result.pruned).toBe(false);
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it("does NOT prune when the signature is absent (requireSignature)", async () => {
    const { raw, id } = buildInbox("note");
    mockFetch.mockImplementation(async (_repo, path) =>
      path === "memory/inbox.md" ? raw : path === TARGET ? "# Some other note, no marker\n" : "",
    );

    const result = await pruneInboxEntry({
      ctx,
      entryId: id,
      targets: [{ path: TARGET, requireSignature: true }],
    });

    expect(result.pruned).toBe(false);
    expect(mockCommit).not.toHaveBeenCalled();
  });

  it("prunes a sibling-writer target on presence alone (no signature required)", async () => {
    const { raw, id } = buildInbox("https://youtu.be/x");
    const ytNote = "---\ntitle: A video\n---\n\nTranscript…\n";
    mockFetch.mockImplementation(async (_repo, path) =>
      path === "memory/inbox.md" ? raw : path === "brain/youtube/chan/2026-06-09-a.md" ? ytNote : "",
    );

    const result = await pruneInboxEntry({
      ctx,
      entryId: id,
      targets: [{ path: "brain/youtube/chan/2026-06-09-a.md", requireSignature: false }],
    });

    expect(result.pruned).toBe(true);
  });

  it("is a no-op when the entry is already gone from the inbox", async () => {
    const { raw } = buildInbox("note");
    mockFetch.mockImplementation(async (_repo, path) =>
      path === "memory/inbox.md" ? raw : "whatever",
    );

    const result = await pruneInboxEntry({
      ctx,
      entryId: "some-other-id-not-in-inbox",
      targets: [{ path: TARGET, requireSignature: false }],
    });

    expect(result.pruned).toBe(false);
    if (!result.pruned) expect(result.reason).toMatch(/already pruned/);
    expect(mockCommit).not.toHaveBeenCalled();
  });
});
