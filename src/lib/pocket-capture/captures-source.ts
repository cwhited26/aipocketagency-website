// captures-source.ts — the unified capture-feed reader behind /app/captures (server-only: it talks to
// GitHub). The dashboard shows EVERY capture from EVERY surface in one reverse-chronological feed, so
// this aggregates the two physical homes a capture can live in:
//
//   • memory/inbox.md          — PA-INBOX blocks: typed/API, email forward, SMS, share sheet, voice
//                                shortcut (the source meta distinguishes them).
//   • inbox/**/*.md            — one file per capture: the in-app voice recorder writes
//                                inbox/voice-memos/<date>/<time>-<slug>.md; any other inbox/<type>/…
//                                file is parsed generically. (Older iOS share files under
//                                sessions/inbox/ keep their own /app/brain/inbox surface — out of
//                                scope here, which reads strictly memory/inbox.md + inbox/**.)
//
// One recursive git-tree request enumerates every inbox/** file (no per-directory walk), the files are
// fetched + parsed in parallel, each entry is validated through the CaptureItem Zod boundary, and the
// merged feed is cached ~60s per brain repo so a reload doesn't re-hit GitHub on every navigation.

import { fetchFileContent, listRepoTree } from "@/lib/pa-brain";
import {
  parseInboxForDisplay,
  parseShareSheetFile,
  parseVoiceMemoFile,
  mergeInboxEntries,
  type InboxEntry,
} from "@/lib/pa-inbox";
import { toCaptureItem, toDashboardCapture, type DashboardCapture } from "./dashboard";

const INBOX_FILE = "memory/inbox.md";
const INBOX_DIR_PREFIX = "inbox/";
const VOICE_MEMO_PREFIX = "inbox/voice-memos/";
const CACHE_TTL_MS = 60_000;

type CacheRow = { at: number; data: DashboardCapture[] };
// Per-brain-repo memoization. Module-level → per serverless instance (good enough for a 60s window);
// the cache key is the repo because a user's captures are scoped to their single brain repo.
const cache = new Map<string, CacheRow>();

// A file-backed capture is a voice memo when it lives under inbox/voice-memos/ OR declares itself one
// in frontmatter (source: voice-memo / kind: voice). Everything else under inbox/ is parsed as a
// generic share-style file (frontmatter + body). We peek only the head so the check stays cheap.
function looksLikeVoiceMemo(path: string, raw: string): boolean {
  if (path.startsWith(VOICE_MEMO_PREFIX)) return true;
  const head = raw.slice(0, 600);
  return /^\s*(?:source:\s*voice|kind:\s*voice)\b/m.test(head);
}

function parseInboxFile(path: string, raw: string): InboxEntry | null {
  return looksLikeVoiceMemo(path, raw) ? parseVoiceMemoFile(path, raw) : parseShareSheetFile(path, raw);
}

/** Validate each merged entry at the CaptureItem boundary, dropping (and logging) any malformed row. */
function toValidatedRows(entries: InboxEntry[]): DashboardCapture[] {
  const rows: DashboardCapture[] = [];
  for (const entry of entries) {
    try {
      toCaptureItem(entry); // Zod boundary: throws on a malformed shape (e.g. an unparseable date).
      rows.push(toDashboardCapture(entry));
    } catch (error) {
      console.error("[captures] dropped malformed capture", {
        path: entry.path ?? INBOX_FILE,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return rows;
}

/**
 * The unified capture feed for one brain repo: every capture from memory/inbox.md and inbox/**,
 * normalized, validated, newest-first, cached ~60s. The caller has already resolved repo + token.
 */
export async function loadDashboardCaptures(
  repo: string,
  token: string,
): Promise<DashboardCapture[]> {
  const cached = cache.get(repo);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  // One tree request enumerates the whole repo; we read the inbox.md block file in parallel with it.
  const [blockRaw, tree] = await Promise.all([
    fetchFileContent(repo, INBOX_FILE, token),
    listRepoTree(repo, token),
  ]);

  const inboxFilePaths = tree
    .filter((e) => e.type === "blob" && e.path.startsWith(INBOX_DIR_PREFIX) && e.path.endsWith(".md"))
    .map((e) => e.path);

  const fileEntries = (
    await Promise.all(
      inboxFilePaths.map(async (path) => parseInboxFile(path, await fetchFileContent(repo, path, token))),
    )
  ).filter((e): e is InboxEntry => e !== null);

  const blockEntries = parseInboxForDisplay(blockRaw);
  const merged = mergeInboxEntries(blockEntries, fileEntries);
  const data = toValidatedRows(merged);

  cache.set(repo, { at: Date.now(), data });
  return data;
}

/** Drop the cached feed for a repo (used after a mutation so the next read reflects it). */
export function invalidateCapturesCache(repo: string): void {
  cache.delete(repo);
}
