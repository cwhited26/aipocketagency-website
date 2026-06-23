// Unit test for the streaming orchestrator's idempotency (MP-CORE-2): a second start for the same
// session is a no-op (opens exactly one Deepgram socket); a failed resolve clears the reservation.
// All network/crypto deps mocked.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/connectors/deepgram/db", () => ({
  fetchDeepgramConnectionFull: vi.fn(async () => ({ ok: true, data: { apiKeyEncrypted: "env" } })),
}));
vi.mock("@/lib/connectors/deepgram/key", () => ({
  decryptDeepgramKey: vi.fn(() => "dgkey"),
  DeepgramKeyDecryptionError: class extends Error {},
}));
vi.mock("@/lib/connectors/deepgram/client", () => ({
  openLiveTranscriptionSocket: vi.fn(() => ({
    socket: { addEventListener: vi.fn() },
    sendAudio: vi.fn(),
    finish: vi.fn(),
    close: vi.fn(),
  })),
  parseDeepgramResult: vi.fn(() => null),
}));
vi.mock("@/lib/connectors/recall-ai/db", () => ({
  fetchMeetingSessionById: vi.fn(async () => ({
    ok: true,
    data: { id: "s1", owner_id: "o1", recall_bot_id: "b1", meeting_url: "u", meeting_provider: "zoom", meeting_start_at: null, meeting_end_at: null, created_at: "2026-06-23T00:00:00Z" },
  })),
  fetchRecallConnectionFull: vi.fn(async () => ({ ok: true, data: null })),
}));
vi.mock("@/lib/crypto/recall-key", () => ({
  decryptRecallKey: vi.fn(() => "recallkey"),
  RecallKeyDecryptionError: class extends Error {},
}));
vi.mock("@/lib/connectors/recall-ai/client", () => ({
  getBotAudioStreamUrl: vi.fn(async () => ({ ok: true, data: null })),
}));
vi.mock("../db", () => ({ appendTranscriptChunk: vi.fn(async () => ({ ok: true, data: undefined })) }));
vi.mock("../brain-write", () => ({ writeTranscriptToBrain: vi.fn(async () => ({ ok: true, brainPath: "p", commitSha: null, byteCount: 0 })) }));

import {
  __resetActiveStreamsForTest,
  isTranscriptionStreamActive,
  startTranscriptionStream,
} from "../transcribe";
import { openLiveTranscriptionSocket } from "@/lib/connectors/deepgram/client";
import { fetchDeepgramConnectionFull } from "@/lib/connectors/deepgram/db";

beforeEach(() => {
  __resetActiveStreamsForTest();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("startTranscriptionStream idempotency", () => {
  it("opens exactly one socket across repeated starts for the same session", async () => {
    const first = await startTranscriptionStream({ sessionId: "s1", recallBotId: "b1" });
    const second = await startTranscriptionStream({ sessionId: "s1", recallBotId: "b1" });

    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.alreadyRunning).toBe(false);
      expect(first.audioSource).toBe("stubbed"); // no realtime audio endpoint → documented stub
    }
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.alreadyRunning).toBe(true);

    expect(vi.mocked(openLiveTranscriptionSocket)).toHaveBeenCalledTimes(1);
    expect(isTranscriptionStreamActive("s1")).toBe(true);
  });

  it("clears the reservation when a resolve fails (no leaked active stream)", async () => {
    vi.mocked(fetchDeepgramConnectionFull).mockResolvedValueOnce({ ok: true, data: null });
    const res = await startTranscriptionStream({ sessionId: "s2", recallBotId: "b2" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(409);
    expect(isTranscriptionStreamActive("s2")).toBe(false);
    expect(vi.mocked(openLiveTranscriptionSocket)).not.toHaveBeenCalled();
  });
});
