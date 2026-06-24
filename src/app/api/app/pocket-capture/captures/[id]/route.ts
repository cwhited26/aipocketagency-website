// /api/app/pocket-capture/captures/[id] — mutate one capture in the signed-in owner's brain
// (PC-CORE-6). The unified feed merges two physical homes, and a capture is mutated where it lives:
//
//   • memory/inbox.md PA-INBOX block (id = the block UUID): rewrite the block's meta in place.
//   • a file-backed capture — a voice memo / share file (id = `file:<base64url(path)>`): rewrite the
//     file's own frontmatter. The file is never deleted; soft-delete stamps `deleted_at` and tags are
//     written to the frontmatter, the same brain-history-preserving contract as the inbox.md tombstone.
//
//   PATCH  { tags: string[] } → replace the capture's tags (normalized), commit the rewritten file.
//   DELETE                    → soft-delete: stamp the tombstone so the dashboard hides it.
//
// Every path applies a pure transform (pa-inbox) and commits via the shared GitHub write path
// (commitMemoryFile, mode=replace). Owner-scoped: we only ever read/write the caller's own brain repo.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent, commitMemoryFile } from "@/lib/pa-brain";
import {
  parseInboxForDisplay,
  setEntryTagsInRaw,
  softDeleteEntryInRaw,
  setFileTags,
  setFileDeletedAt,
} from "@/lib/pa-inbox";
import { CAPTURE_INBOX_PATH } from "@/lib/pocket-capture/feed";
import { decodeFileCaptureId } from "@/lib/pocket-capture/dashboard";
import { invalidateCapturesCache } from "@/lib/pocket-capture/captures-source";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  tags: z.array(z.string()).max(50),
});

type Brain = { repo: string; token: string };

/** Resolve the caller + their brain repo, or a NextResponse to return early. */
async function resolveBrain(): Promise<
  { ok: true; userId: string; brain: Brain } | { ok: false; response: NextResponse }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return { ok: false, response: NextResponse.json({ error: "User record not found" }, { status: 404 }) };
  }
  const paUser = paResult.data;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = paUser.github_token ?? session?.provider_token ?? null;
  if (!paUser.brain_repo || !token) {
    return { ok: false, response: NextResponse.json({ error: "No brain repo connected" }, { status: 400 }) };
  }

  return { ok: true, userId: user.id, brain: { repo: paUser.brain_repo, token } };
}

/** True when a capture with this id exists as a PA-INBOX block in the file. */
function entryExists(raw: string, id: string): boolean {
  return parseInboxForDisplay(raw).some((e) => e.id === id);
}

// One mutation, expressed as a pure transform over the backing file's raw content. A block mutation
// targets memory/inbox.md and keys on the block id; a file mutation targets the capture's own file.
type Mutation =
  | { kind: "tags"; tags: string[] }
  | { kind: "delete" };

function applyBlockMutation(raw: string, id: string, mutation: Mutation): string {
  return mutation.kind === "tags"
    ? setEntryTagsInRaw(raw, id, mutation.tags)
    : softDeleteEntryInRaw(raw, id);
}

function applyFileMutation(raw: string, mutation: Mutation): string {
  return mutation.kind === "tags" ? setFileTags(raw, mutation.tags) : setFileDeletedAt(raw);
}

/**
 * Resolve the backing file + the rewritten content for a capture id, or a NextResponse to return.
 * A `file:`-prefixed id is a file-backed capture (decode → its own path); anything else is an
 * inbox.md block. Returns the file path to commit and the new content (post-transform).
 */
async function resolveWrite(
  brain: Brain,
  id: string,
  mutation: Mutation,
): Promise<{ ok: true; path: string; content: string } | { ok: false; response: NextResponse }> {
  const filePath = decodeFileCaptureId(id);

  if (filePath) {
    const raw = await fetchFileContent(brain.repo, filePath, brain.token);
    if (!raw.trim()) {
      return { ok: false, response: NextResponse.json({ error: "Capture not found" }, { status: 404 }) };
    }
    return { ok: true, path: filePath, content: applyFileMutation(raw, mutation) };
  }

  const raw = await fetchFileContent(brain.repo, CAPTURE_INBOX_PATH, brain.token);
  if (!entryExists(raw, id)) {
    return { ok: false, response: NextResponse.json({ error: "Capture not found" }, { status: 404 }) };
  }
  return { ok: true, path: CAPTURE_INBOX_PATH, content: applyBlockMutation(raw, id, mutation) };
}

async function commitMutation(
  brain: Brain,
  userId: string,
  id: string,
  mutation: Mutation,
  failure: string,
): Promise<NextResponse> {
  const resolved = await resolveWrite(brain, id, mutation);
  if (!resolved.ok) return resolved.response;

  const verb = mutation.kind === "tags" ? "tag" : "delete";
  const result = await commitMemoryFile({
    repo: brain.repo,
    token: brain.token,
    path: resolved.path,
    mode: "replace",
    content: resolved.content,
    commitMessage: `Pocket Capture — ${verb} capture ${id.slice(0, 16)}`,
  });
  if (!result.ok) {
    console.error(`[captures] ${verb} write failed`, { ownerId: userId, path: resolved.path, error: result.error });
    return NextResponse.json({ error: failure }, { status: 502 });
  }

  invalidateCapturesCache(brain.repo);
  return NextResponse.json({ ok: true, sha: result.sha });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const resolved = await resolveBrain();
  if (!resolved.ok) return resolved.response;

  let tags: string[];
  try {
    const body = (await req.json().catch(() => ({}))) as unknown;
    tags = PatchSchema.parse(body).tags;
  } catch {
    return NextResponse.json({ error: "Body must be { tags: string[] }" }, { status: 400 });
  }

  return commitMutation(resolved.brain, resolved.userId, params.id, { kind: "tags", tags }, "Could not save tags");
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const resolved = await resolveBrain();
  if (!resolved.ok) return resolved.response;

  return commitMutation(resolved.brain, resolved.userId, params.id, { kind: "delete" }, "Could not delete capture");
}
