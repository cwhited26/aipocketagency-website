// cleanup.ts — the cleanup pass (PA-CAPTURE-3): once a captured entry has been folded into a
// dedicated brain note, remove it from memory/inbox.md so the inbox only ever holds what's still
// unfiled. This is conservative by construction: it NEVER deletes content that isn't also written
// elsewhere. Before pruning, it re-reads each candidate target path and confirms the content is
// actually present — only then does it rewrite memory/inbox.md without the entry.
//
// Triggered as part of the routing/triage acceptance step (the share endpoint after a rule routes or
// the ingester writes; the approve route after a triage proposal is accepted) — never a standalone
// cron. Idempotent: a second call for an already-pruned entry is a no-op success.

import { commitMemoryFile, fetchFileContent } from "@/lib/pa-brain";
import { parseInboxForDisplay, removeEntryFromRaw } from "@/lib/pa-inbox";
import { captureSignature } from "./types";

const INBOX_PATH = "memory/inbox.md";

export type CleanupCtx = { repo: string; token: string };

/**
 * One piece of evidence that an entry now lives in the brain. `requireSignature` is true for notes
 * the Capture Inbox itself wrote (routing / triage — they embed the capture signature, so we verify
 * the exact entry is present); it is false for notes a sibling writer produced (the YouTube/Podcast
 * ingester), where the evidence is that the writer just committed a non-empty note at that path.
 */
export type CleanupTarget = { path: string; requireSignature: boolean };

export type CleanupResult =
  | { pruned: true; sha: string }
  | { pruned: false; reason: string };

/** Confirm at least one target genuinely holds the entry's content before we allow a prune. */
async function targetConfirmsContent(
  ctx: CleanupCtx,
  entryId: string,
  targets: CleanupTarget[],
): Promise<boolean> {
  const signature = captureSignature(entryId);
  for (const target of targets) {
    const content = await fetchFileContent(ctx.repo, target.path, ctx.token);
    if (!content || !content.trim()) continue;
    if (target.requireSignature) {
      if (content.includes(signature)) return true;
    } else {
      // Sibling-writer note (e.g. an ingested transcript) — its presence + non-emptiness is the proof.
      return true;
    }
  }
  return false;
}

/**
 * Prune one entry from memory/inbox.md, but only after confirming its content is present in at least
 * one target brain path. Returns pruned:false with an honest reason when the entry is already gone,
 * the inbox can't be read, or no target confirms the content (the safe default — leave it in place).
 */
export async function pruneInboxEntry(params: {
  ctx: CleanupCtx;
  entryId: string;
  targets: CleanupTarget[];
}): Promise<CleanupResult> {
  const { ctx, entryId, targets } = params;
  if (targets.length === 0) return { pruned: false, reason: "no targets to confirm against" };

  // fetchFileContent returns "" for a missing/unreadable file (never null).
  const inboxRaw = await fetchFileContent(ctx.repo, INBOX_PATH, ctx.token);
  if (!inboxRaw.trim()) return { pruned: false, reason: "inbox not found" };

  // Idempotent: if the entry is already absent, nothing to do.
  const present = parseInboxForDisplay(inboxRaw).some((e) => e.id === entryId);
  if (!present) return { pruned: false, reason: "entry already pruned" };

  const confirmed = await targetConfirmsContent(ctx, entryId, targets);
  if (!confirmed) return { pruned: false, reason: "content not confirmed at any target" };

  const next = removeEntryFromRaw(inboxRaw, entryId);
  const commit = await commitMemoryFile({
    repo: ctx.repo,
    token: ctx.token,
    path: INBOX_PATH,
    mode: "replace",
    content: next,
    commitMessage: "Pocket Agent — Capture Inbox: filed an entry, pruned from inbox",
  });
  if (!commit.ok) return { pruned: false, reason: commit.error };
  return { pruned: true, sha: commit.sha };
}
