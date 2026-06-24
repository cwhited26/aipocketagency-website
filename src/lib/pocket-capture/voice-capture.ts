// voice-capture.ts — turn a dictated iOS Shortcut text into a Capture Inbox entry (PC-CORE-4).
// Reuses the shipped brain write path (fetchFileContent + appendEntryToRaw + commitMemoryFile)
// exactly like the email / SMS / share surfaces, tagging the entry source="voice_shortcut" so the
// dashboard shows the voice icon. Text-only: the Shortcut sends dictated text, never attachments.

import { fetchFileContent, commitMemoryFile } from "@/lib/pa-brain";
import { appendEntryToRaw } from "@/lib/pa-inbox";
import type { CaptureOwner } from "./slug";

const INBOX_PATH = "memory/inbox.md";
export const VOICE_SHORTCUT_SOURCE = "voice_shortcut";

export type VoiceCaptureResult =
  | { ok: true; brainPath: string }
  | { ok: false; reason: "no-brain" | "empty" | "commit-failed"; error: string };

/**
 * Compose the capture body. An optional source_hint (the Shortcut can pass where it ran — "siri",
 * "watch", "action-button") rides as a provenance line so the feed can show context. Pure → tested.
 */
export function buildVoiceCaptureContent(params: { text: string; sourceHint?: string }): string {
  const sections: string[] = [];
  if (params.sourceHint?.trim()) sections.push(`Via: ${params.sourceHint.trim()}`);
  sections.push(params.text.trim());
  return sections.join("\n\n");
}

/**
 * Write a dictated capture into the owner's Capture Inbox. Returns reason "empty" when the text is
 * blank (the caller should 400), "no-brain" when the owner hasn't connected a brain repo (the
 * caller should surface a connect-your-brain message), or "commit-failed" on a GitHub write error.
 */
export async function writeVoiceShortcutCapture(params: {
  owner: CaptureOwner;
  text: string;
  sourceHint?: string;
}): Promise<VoiceCaptureResult> {
  const { owner, text, sourceHint } = params;
  if (!text.trim()) return { ok: false, reason: "empty", error: "no text to capture" };
  if (!owner.brain_repo || !owner.github_token) {
    return { ok: false, reason: "no-brain", error: "owner has no brain repo connected" };
  }
  const repo = owner.brain_repo;
  const token = owner.github_token;

  const content = buildVoiceCaptureContent({ text, sourceHint });

  const existing = await fetchFileContent(repo, INBOX_PATH, token);
  const { content: nextRaw } = appendEntryToRaw(existing, {
    kind: "note",
    content,
    source: VOICE_SHORTCUT_SOURCE,
  });

  const commit = await commitMemoryFile({
    repo,
    token,
    path: INBOX_PATH,
    mode: "replace",
    content: nextRaw,
    commitMessage: "Pocket Capture — voice shortcut capture",
  });
  if (!commit.ok) return { ok: false, reason: "commit-failed", error: commit.error };

  return { ok: true, brainPath: INBOX_PATH };
}
