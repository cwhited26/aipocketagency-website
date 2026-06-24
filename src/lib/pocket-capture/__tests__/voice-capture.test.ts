import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the brain write path so writeVoiceShortcutCapture's commit is observable without real GitHub.
vi.mock("@/lib/pa-brain", () => ({
  fetchFileContent: vi.fn(async () => ""),
  commitMemoryFile: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/pa-inbox", () => ({
  appendEntryToRaw: vi.fn(
    (existing: string, entry: { content: string; source?: string }) => ({
      content: `${existing}\nsource:${entry.source}\n${entry.content}`,
    }),
  ),
}));

import {
  VOICE_SHORTCUT_SOURCE,
  buildVoiceCaptureContent,
  writeVoiceShortcutCapture,
} from "../voice-capture";
import { appendEntryToRaw } from "@/lib/pa-inbox";
import { commitMemoryFile } from "@/lib/pa-brain";

const owner = { id: "owner-1", brain_repo: "user/brain", github_token: "ghtok" };

afterEach(() => {
  vi.clearAllMocks();
});

describe("buildVoiceCaptureContent", () => {
  it("returns the trimmed text alone when no source hint", () => {
    expect(buildVoiceCaptureContent({ text: "  call the dentist  " })).toBe("call the dentist");
  });
  it("prepends a Via: provenance line when a source hint is present", () => {
    const out = buildVoiceCaptureContent({ text: "idea for the hook", sourceHint: "siri" });
    expect(out).toContain("Via: siri");
    expect(out).toContain("idea for the hook");
  });
});

describe("writeVoiceShortcutCapture", () => {
  it("writes the capture tagged source=voice_shortcut", async () => {
    const result = await writeVoiceShortcutCapture({ owner, text: "remember the whiteboard" });
    expect(result).toEqual({ ok: true, brainPath: "memory/inbox.md" });

    // Tagged with the voice_shortcut source so the dashboard shows the right icon.
    expect(vi.mocked(appendEntryToRaw)).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ kind: "note", source: VOICE_SHORTCUT_SOURCE }),
    );
    const commitArg = vi.mocked(commitMemoryFile).mock.calls[0][0];
    expect(commitArg.path).toBe("memory/inbox.md");
    expect(commitArg.content).toContain("source:voice_shortcut");
    expect(commitArg.content).toContain("remember the whiteboard");
  });

  it("returns reason=empty for blank text without touching the brain", async () => {
    const result = await writeVoiceShortcutCapture({ owner, text: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty");
    expect(commitMemoryFile).not.toHaveBeenCalled();
  });

  it("returns reason=no-brain when the owner has no brain repo connected", async () => {
    const result = await writeVoiceShortcutCapture({
      owner: { id: "o", brain_repo: null, github_token: null },
      text: "hi",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no-brain");
    expect(commitMemoryFile).not.toHaveBeenCalled();
  });

  it("surfaces a commit failure as reason=commit-failed", async () => {
    vi.mocked(commitMemoryFile).mockResolvedValueOnce({ ok: false, error: "github 500" });
    const result = await writeVoiceShortcutCapture({ owner, text: "hi" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("commit-failed");
      expect(result.error).toContain("github 500");
    }
  });
});
