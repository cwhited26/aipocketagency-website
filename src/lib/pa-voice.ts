// Voice-memo capture helpers — shared by the transcribe/save routes and the
// Capture Inbox surfacing. A voice memo is one markdown file committed to the
// member's brain repo at:
//   inbox/voice-memos/YYYY-MM-DD/<HHMMSS>-<slug>.md
// with frontmatter the rest of the brain can read.

export type VoiceMemoInput = {
  // ISO timestamp the memo was captured. Drives both the frontmatter and the
  // file path so the two never disagree.
  capturedAt: string;
  // User-entered topic, or "" when they didn't enter one.
  topic: string;
  durationSeconds: number;
  transcript: string;
};

// Turn a topic (or, failing that, the transcript) into a filesystem-safe slug.
// Always returns a non-empty token so the file path is well-formed.
export function voiceMemoSlug(topic: string, transcript: string): string {
  const source = topic.trim() || transcript.trim();
  const slug = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 8)
    .join("-")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return slug || "untitled";
}

// Build the repo path for a memo from its capture timestamp and slug.
// Uses the UTC date/time so the date directory and the file's HHMMSS prefix
// are derived from a single instant.
export function voiceMemoPath(capturedAtIso: string, slug: string): string {
  const date = capturedAtIso.slice(0, 10); // YYYY-MM-DD
  const time = capturedAtIso.slice(11, 19).replace(/:/g, ""); // HHMMSS
  return `inbox/voice-memos/${date}/${time}-${slug}.md`;
}

export function voiceMemoCommitMessage(capturedAtIso: string, topic: string): string {
  const date = capturedAtIso.slice(0, 10);
  const label = topic.trim() || "untitled";
  return `[${date}] Pocket Agent — Voice memo: ${label}`;
}

// Render the markdown file contents (frontmatter + transcript body).
export function buildVoiceMemoMarkdown(input: VoiceMemoInput): string {
  const topic = input.topic.trim();
  const front = [
    "---",
    `captured_at: ${input.capturedAt}`,
    "source: voice-memo",
    `topic: ${topic}`,
    `duration_seconds: ${input.durationSeconds}`,
    "---",
  ].join("\n");
  return `${front}\n\n${input.transcript.trim()}\n`;
}
