// execute.ts — the in-process "brain" connector executor. Runs when the owner approves the
// staged profile commit: reads the generated profile + log + screenshots off the run row
// (the staged payload is a reference, never the body), commits everything to the owner's brain
// in ONE commit via the existing GitHub plumbing, and stamps the row committed. Ownership is
// enforced here — the extraction row must belong to the approving user.

import { commitBrainFiles, type CommitFile } from "@/lib/brain/absorb";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchExtractionRow, updateExtractionRow } from "@/lib/url-extraction/db";
import { sourceSlugFromUrl } from "@/lib/url-extraction/types";
import {
  BRAIN_CONNECTOR,
  COMMIT_PROFILE_ACTION,
  commitProfilePayloadOf,
  screenshotPathFor,
} from "./types";

export { BRAIN_CONNECTOR };

export type BrainExecuteResult =
  | { ok: true; summary: string; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export async function executeBrainConnectorAction(input: {
  userId: string;
  action: string;
  payload: Record<string, unknown>;
}): Promise<BrainExecuteResult> {
  if (input.action !== COMMIT_PROFILE_ACTION) {
    return { ok: false, status: 400, error: `Unknown brain action: ${input.action}` };
  }
  const payload = commitProfilePayloadOf(input.payload);
  if (!payload) {
    return { ok: false, status: 400, error: "The staged payload is missing its profile reference." };
  }

  const rowResult = await fetchExtractionRow(payload.extraction_id);
  if (!rowResult.ok) return { ok: false, status: 500, error: rowResult.error };
  const row = rowResult.data;
  if (!row || row.owner_id !== input.userId) {
    return { ok: false, status: 404, error: "That capture doesn't exist on your account." };
  }
  if (!row.profile_md) {
    return { ok: false, status: 409, error: "That capture has no generated profile to commit." };
  }

  const pa = await fetchPaUser(input.userId);
  if (!pa.ok || !pa.data || !pa.data.brain_repo || !pa.data.github_token) {
    return { ok: false, status: 409, error: "Connect your brain repo in Settings before committing profiles." };
  }

  const sourceSlug = sourceSlugFromUrl(row.source_url);
  const files = new Map<string, CommitFile>([
    [payload.profile_path, { content: row.profile_md, encoding: "utf-8" }],
  ]);
  if (row.extraction_log_md) {
    files.set(payload.log_path, { content: row.extraction_log_md, encoding: "utf-8" });
  }
  for (const shot of row.screenshots ?? []) {
    files.set(screenshotPathFor(sourceSlug, shot.name), { content: shot.base64, encoding: "base64" });
  }

  const commit = await commitBrainFiles({
    repo: pa.data.brain_repo,
    token: pa.data.github_token,
    files,
    commitMessage: `Pocket Agent — Competitor Inspector: ${sourceSlug}`,
  });
  if (!commit.ok) return { ok: false, status: 502, error: commit.error };

  const stamp = await updateExtractionRow(row.id, {
    status: "committed",
    dna_record_path: payload.profile_path,
    extraction_log_path: payload.log_path,
  });
  if (!stamp.ok) {
    // The commit is real — surface the bookkeeping miss, never undo the success.
    console.warn("[competitor-inspector/execute] committed but row stamp failed", {
      extractionId: row.id,
      error: stamp.error,
    });
  }

  return {
    ok: true,
    summary: `Profile committed to your brain at ${payload.profile_path}`,
    data: { sha: commit.sha, profile_path: payload.profile_path },
  };
}
