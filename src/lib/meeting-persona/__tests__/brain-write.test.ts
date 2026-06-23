// Unit tests for transcript brain-write (MP-CORE-2): markdown formatting + write idempotency
// (deterministic path → overwrite; audit upsert keyed on session+path). Deps mocked, no network.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/brain/absorb", () => ({
  commitBrainTextFile: vi.fn(async () => ({ ok: true, sha: "sha_abc123" })),
}));
vi.mock("@/lib/pa-supabase", () => ({
  fetchPaUser: vi.fn(async () => ({ ok: true, data: { brain_repo: "owner/brain", github_token: "ght" } })),
}));
vi.mock("@/lib/connectors/recall-ai/db", () => ({
  fetchMeetingSessionById: vi.fn(),
}));
vi.mock("../db", () => ({
  fetchTranscriptChunks: vi.fn(),
  recordTranscriptWrite: vi.fn(async () => ({ ok: true, data: undefined })),
}));

import {
  formatTranscriptMarkdown,
  transcriptBrainPath,
  writeTranscriptToBrain,
} from "../brain-write";
import { commitBrainTextFile } from "@/lib/brain/absorb";
import { fetchMeetingSessionById } from "@/lib/connectors/recall-ai/db";
import { fetchTranscriptChunks, recordTranscriptWrite } from "../db";

const SESSION = {
  id: "11111111-1111-1111-1111-111111111111",
  owner_id: "owner-1",
  recall_bot_id: "bot_abcdef123456",
  meeting_url: "https://zoom.us/j/999",
  meeting_provider: "zoom",
  meeting_start_at: "2026-06-23T15:00:00.000Z",
  meeting_end_at: null,
  created_at: "2026-06-23T15:00:00.000Z",
};

const CHUNKS = [
  { chunk_seq: 0, speaker_label: "speaker_0", text: "Hey, thanks for hopping on.", start_ms: 0, end_ms: 2000, confidence: 0.99, is_final: true },
  { chunk_seq: 1, speaker_label: "speaker_0", text: "Did you see the quote?", start_ms: 2000, end_ms: 4000, confidence: 0.97, is_final: true },
  { chunk_seq: 2, speaker_label: "speaker_1", text: "I did, looks good.", start_ms: 4000, end_ms: 6000, confidence: 0.95, is_final: true },
];

beforeEach(() => {
  vi.mocked(fetchMeetingSessionById).mockResolvedValue({ ok: true, data: SESSION });
  vi.mocked(fetchTranscriptChunks).mockResolvedValue({ ok: true, data: CHUNKS });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("formatTranscriptMarkdown", () => {
  it("emits frontmatter + merges consecutive same-speaker chunks", () => {
    const md = formatTranscriptMarkdown(SESSION, CHUNKS);
    expect(md).toContain("meeting_id: 11111111-1111-1111-1111-111111111111");
    expect(md).toContain("date: 2026-06-23");
    expect(md).toContain("duration_sec: 6");
    expect(md).toContain("participants: [speaker_0, speaker_1]");
    // speaker_0's two consecutive chunks merge into one line.
    expect(md).toContain("**speaker_0:** Hey, thanks for hopping on. Did you see the quote?");
    expect(md).toContain("**speaker_1:** I did, looks good.");
  });

  it("handles an empty transcript", () => {
    const md = formatTranscriptMarkdown(SESSION, []);
    expect(md).toContain("_(no transcribed speech)_");
  });
});

describe("transcriptBrainPath", () => {
  it("is deterministic per session (the idempotent overwrite key)", () => {
    expect(transcriptBrainPath(SESSION)).toBe("meetings/2026-06-23/zoom-botabcde.md");
    expect(transcriptBrainPath(SESSION)).toBe(transcriptBrainPath(SESSION));
  });
});

describe("writeTranscriptToBrain idempotency", () => {
  it("writes to the same path + same audit key on repeated calls (overwrite, not duplicate)", async () => {
    const first = await writeTranscriptToBrain({ sessionId: SESSION.id });
    const second = await writeTranscriptToBrain({ sessionId: SESSION.id });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    const commitCalls = vi.mocked(commitBrainTextFile).mock.calls;
    expect(commitCalls).toHaveLength(2);
    expect(commitCalls[0][0].path).toBe("meetings/2026-06-23/zoom-botabcde.md");
    expect(commitCalls[1][0].path).toBe(commitCalls[0][0].path);

    const auditCalls = vi.mocked(recordTranscriptWrite).mock.calls;
    expect(auditCalls).toHaveLength(2);
    expect(auditCalls[0][0]).toMatchObject({ sessionId: SESSION.id, brainPath: "meetings/2026-06-23/zoom-botabcde.md", commitSha: "sha_abc123" });
    expect(auditCalls[1][0].brainPath).toBe(auditCalls[0][0].brainPath);
  });

  it("records a null-sha attempt when the owner has no brain repo", async () => {
    const { fetchPaUser } = await import("@/lib/pa-supabase");
    vi.mocked(fetchPaUser).mockResolvedValueOnce({ ok: true, data: { brain_repo: null, github_token: null } } as Awaited<ReturnType<typeof fetchPaUser>>);
    const res = await writeTranscriptToBrain({ sessionId: SESSION.id });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.skipped).toBe("no_brain_repo");
    expect(vi.mocked(commitBrainTextFile)).not.toHaveBeenCalled();
    expect(vi.mocked(recordTranscriptWrite).mock.calls[0][0].commitSha).toBeNull();
  });
});
