// meeting-persona/brain-write.ts — persist a meeting's transcript to the owner's brain repo
// (Meeting Persona, MP-CORE-2). Reads the final transcript chunks, formats markdown, commits to
// meetings/<yyyy-mm-dd>/<session-slug>.md, and audits the write (idempotent on session+path).
//
// A failed brain write NEVER crashes the transcription flow: errors are logged + the audit row gets
// a null commit_sha. The owner owns the artifact (transcript lives in their brain repo — PA-BUILD-3
// inherited).

import { commitBrainTextFile } from "@/lib/brain/absorb";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchMeetingSessionById, type MeetingSessionDetail } from "@/lib/connectors/recall-ai/db";
import { fetchTranscriptChunks, recordTranscriptWrite, type TranscriptChunkRow } from "./db";
import { log } from "./log";

export type WriteResult =
  | { ok: true; brainPath: string; commitSha: string | null; byteCount: number; skipped?: "no_brain_repo" | "no_transcript" }
  | { ok: false; status: number; error: string };

/** yyyy-mm-dd from the session's best-known meeting date. */
function meetingDate(session: MeetingSessionDetail): string {
  const iso = session.meeting_start_at ?? session.created_at;
  return iso.slice(0, 10);
}

/** Deterministic per-session slug → stable brain path → idempotent overwrite on re-write. */
export function transcriptSlug(session: MeetingSessionDetail): string {
  const provider = session.meeting_provider ?? "meeting";
  const shortId = session.recall_bot_id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bot";
  return `${provider}-${shortId}`;
}

export function transcriptBrainPath(session: MeetingSessionDetail): string {
  return `meetings/${meetingDate(session)}/${transcriptSlug(session)}.md`;
}

/** Distinct speaker labels in order of first appearance. */
function participantList(chunks: TranscriptChunkRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of chunks) {
    const label = c.speaker_label ?? "unknown";
    if (!seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

/**
 * Format final transcript chunks into the brain markdown. Consecutive chunks from the same speaker
 * merge into one paragraph. Pure — exported for unit tests.
 */
export function formatTranscriptMarkdown(
  session: MeetingSessionDetail,
  chunks: TranscriptChunkRow[],
): string {
  const date = meetingDate(session);
  const durationSec = chunks.reduce((max, c) => Math.max(max, c.end_ms), 0) / 1000;
  const participants = participantList(chunks);

  const frontmatter = [
    "---",
    `meeting_id: ${session.id}`,
    `date: ${date}`,
    `duration_sec: ${Math.round(durationSec)}`,
    `participants: [${participants.join(", ")}]`,
    "---",
  ].join("\n");

  const lines: string[] = [];
  let currentSpeaker: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length > 0 && currentSpeaker !== null) {
      lines.push(`**${currentSpeaker}:** ${buffer.join(" ")}`);
      buffer = [];
    }
  };
  for (const c of chunks) {
    const label = c.speaker_label ?? "unknown";
    if (label !== currentSpeaker) {
      flush();
      currentSpeaker = label;
    }
    buffer.push(c.text.trim());
  }
  flush();

  const body = lines.length > 0 ? lines.join("\n\n") : "_(no transcribed speech)_";
  return `${frontmatter}\n\n# Meeting transcript — ${date}\n\n${body}\n`;
}

/**
 * Write the session's final transcript to the owner's brain repo + audit the write. Idempotent: the
 * path is deterministic per session (overwrite), and the audit upserts on (session_id, brain_path).
 */
export async function writeTranscriptToBrain(input: { sessionId: string }): Promise<WriteResult> {
  const sessionRes = await fetchMeetingSessionById(input.sessionId);
  if (!sessionRes.ok) return { ok: false, status: sessionRes.status, error: sessionRes.error };
  if (!sessionRes.data) return { ok: false, status: 404, error: "Meeting session not found." };
  const session = sessionRes.data;

  const chunksRes = await fetchTranscriptChunks(input.sessionId, { finalsOnly: true });
  if (!chunksRes.ok) return { ok: false, status: chunksRes.status, error: chunksRes.error };
  const chunks = chunksRes.data;

  const brainPath = transcriptBrainPath(session);
  if (chunks.length === 0) {
    log.warn("writeTranscriptToBrain: no final transcript chunks — nothing to write", {
      session_id: input.sessionId,
    });
    return { ok: true, brainPath, commitSha: null, byteCount: 0, skipped: "no_transcript" };
  }

  const markdown = formatTranscriptMarkdown(session, chunks);
  const byteCount = Buffer.byteLength(markdown, "utf8");

  const paRes = await fetchPaUser(session.owner_id);
  if (!paRes.ok) return { ok: false, status: paRes.status, error: paRes.error };
  const brainRepo = paRes.data?.brain_repo ?? null;
  const githubToken = paRes.data?.github_token ?? null;

  if (!brainRepo || !githubToken) {
    // No brain repo connected — record the attempt (null commit) without failing the meeting flow.
    log.warn("writeTranscriptToBrain: owner has no brain repo connected — recording attempt only", {
      session_id: input.sessionId,
    });
    await recordTranscriptWrite({
      sessionId: input.sessionId,
      brainRepo: brainRepo ?? "(none)",
      brainPath,
      commitSha: null,
      byteCount,
    });
    return { ok: true, brainPath, commitSha: null, byteCount, skipped: "no_brain_repo" };
  }

  const commit = await commitBrainTextFile({
    repo: brainRepo,
    token: githubToken,
    path: brainPath,
    content: markdown,
    commitMessage: `Pocket Agent — meeting transcript ${transcriptSlug(session)} (${meetingDate(session)})`,
  });

  const commitSha = commit.ok ? commit.sha : null;
  if (!commit.ok) {
    log.error("writeTranscriptToBrain: brain commit failed — recorded with null sha", {
      session_id: input.sessionId,
      brain_path: brainPath,
      error: commit.error,
    });
  }

  const audit = await recordTranscriptWrite({
    sessionId: input.sessionId,
    brainRepo,
    brainPath,
    commitSha,
    byteCount,
  });
  if (!audit.ok) {
    log.error("writeTranscriptToBrain: audit upsert failed", {
      session_id: input.sessionId,
      status: audit.status,
      error: audit.error,
    });
  }

  return { ok: true, brainPath, commitSha, byteCount };
}
