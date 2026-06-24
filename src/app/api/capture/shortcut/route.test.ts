import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the auth + account + write seams; exercise the REAL idempotency module so the endpoint's
// dedup behavior is what's under test.
vi.mock("@/lib/pocket-capture/api-tokens", () => ({ verifyApiToken: vi.fn() }));
vi.mock("@/lib/pocket-capture/voice-capture", () => ({ writeVoiceShortcutCapture: vi.fn() }));
vi.mock("@/lib/pa-supabase", () => ({ fetchPaUser: vi.fn() }));

import { POST } from "./route";
import { verifyApiToken } from "@/lib/pocket-capture/api-tokens";
import { writeVoiceShortcutCapture } from "@/lib/pocket-capture/voice-capture";
import { fetchPaUser } from "@/lib/pa-supabase";
import { __resetIdempotencyCacheForTests } from "@/lib/capture-share/idempotency";

function req(body: unknown, headers: Record<string, string> = { authorization: "Bearer pca_good" }): Request {
  return new Request("https://x/api/capture/shortcut", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  __resetIdempotencyCacheForTests();
  // Pin the clock so two captures in a test share the same 5-second idempotency bucket.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-23T12:00:00.000Z"));
  vi.mocked(verifyApiToken).mockResolvedValue({ ownerId: "owner-1" });
  vi.mocked(fetchPaUser).mockResolvedValue({
    ok: true,
    data: { id: "owner-1", brain_repo: "user/brain", github_token: "ghtok" },
  } as Awaited<ReturnType<typeof fetchPaUser>>);
  vi.mocked(writeVoiceShortcutCapture).mockResolvedValue({ ok: true, brainPath: "memory/inbox.md" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("POST /api/capture/shortcut — auth", () => {
  it("401s without a bearer token", async () => {
    const res = await POST(req({ text: "hi" }, {}));
    expect(res.status).toBe(401);
    expect(verifyApiToken).not.toHaveBeenCalled();
  });

  it("401s on an invalid / revoked token", async () => {
    vi.mocked(verifyApiToken).mockResolvedValueOnce(null);
    const res = await POST(req({ text: "hi" }));
    expect(res.status).toBe(401);
    expect(writeVoiceShortcutCapture).not.toHaveBeenCalled();
  });
});

describe("POST /api/capture/shortcut — body validation", () => {
  it("400s on non-JSON", async () => {
    const res = await POST(req("not json{", { authorization: "Bearer pca_good" }));
    expect(res.status).toBe(400);
  });

  it("400s on missing text", async () => {
    const res = await POST(req({ source_hint: "siri" }));
    expect(res.status).toBe(400);
    expect(writeVoiceShortcutCapture).not.toHaveBeenCalled();
  });
});

describe("POST /api/capture/shortcut — capture", () => {
  it("writes the capture and returns success + capture_id", async () => {
    const res = await POST(req({ text: "remember the whiteboard", source_hint: "siri" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; capture_id: string };
    expect(json.success).toBe(true);
    expect(json.capture_id).toMatch(/[0-9a-f-]{36}/);
    // The owner's brain creds (from fetchPaUser) + text are threaded to the write path.
    expect(writeVoiceShortcutCapture).toHaveBeenCalledWith({
      owner: { id: "owner-1", brain_repo: "user/brain", github_token: "ghtok" },
      text: "remember the whiteboard",
      sourceHint: "siri",
    });
  });

  it("dedups an identical re-fire inside the 5-second bucket (no second write)", async () => {
    const first = await POST(req({ text: "same thought" }));
    expect(first.status).toBe(200);
    expect((await first.json()).duplicate).toBeUndefined();

    const second = await POST(req({ text: "same thought" }));
    expect(second.status).toBe(200);
    expect((await second.json()).duplicate).toBe(true);

    // Only the first call reached the write path.
    expect(writeVoiceShortcutCapture).toHaveBeenCalledTimes(1);
  });

  it("does NOT dedup different text from the same owner", async () => {
    await POST(req({ text: "thought one" }));
    await POST(req({ text: "thought two" }));
    expect(writeVoiceShortcutCapture).toHaveBeenCalledTimes(2);
  });

  it("409s when the owner has no brain connected", async () => {
    vi.mocked(writeVoiceShortcutCapture).mockResolvedValueOnce({
      ok: false,
      reason: "no-brain",
      error: "no brain",
    });
    const res = await POST(req({ text: "hi" }));
    expect(res.status).toBe(409);
  });
});
