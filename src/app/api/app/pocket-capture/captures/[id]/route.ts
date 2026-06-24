// /api/app/pocket-capture/captures/[id] — mutate one capture in the signed-in owner's brain
// (PC-CORE-6). Captures are PA-INBOX blocks inside memory/inbox.md (the shared Capture Inbox file).
//
//   PATCH  { tags: string[] } → replace the entry's tags (normalized), commit the rewritten file.
//   DELETE                    → soft-delete: stamp deletedAt so the dashboard hides it while the
//                               block stays in the file (brain history is preserved).
//
// Both read the file, apply a pure transform (pa-inbox), and commit via the shared GitHub write path
// (commitMemoryFile, mode=replace). Owner-scoped: we only ever read/write the caller's own brain repo.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent, commitMemoryFile } from "@/lib/pa-brain";
import {
  parseInboxForDisplay,
  setEntryTagsInRaw,
  softDeleteEntryInRaw,
} from "@/lib/pa-inbox";
import { CAPTURE_INBOX_PATH } from "@/lib/pocket-capture/feed";
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

  const { brain, userId } = resolved;
  const raw = await fetchFileContent(brain.repo, CAPTURE_INBOX_PATH, brain.token);
  if (!entryExists(raw, params.id)) {
    return NextResponse.json({ error: "Capture not found" }, { status: 404 });
  }

  const updated = setEntryTagsInRaw(raw, params.id, tags);
  const result = await commitMemoryFile({
    repo: brain.repo,
    token: brain.token,
    path: CAPTURE_INBOX_PATH,
    mode: "replace",
    content: updated,
    commitMessage: `Pocket Capture — tag capture ${params.id.slice(0, 8)}`,
  });
  if (!result.ok) {
    console.error("[captures] tag write failed", { ownerId: userId, error: result.error });
    return NextResponse.json({ error: "Could not save tags" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sha: result.sha });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const resolved = await resolveBrain();
  if (!resolved.ok) return resolved.response;

  const { brain, userId } = resolved;
  const raw = await fetchFileContent(brain.repo, CAPTURE_INBOX_PATH, brain.token);
  if (!entryExists(raw, params.id)) {
    return NextResponse.json({ error: "Capture not found" }, { status: 404 });
  }

  const updated = softDeleteEntryInRaw(raw, params.id);
  const result = await commitMemoryFile({
    repo: brain.repo,
    token: brain.token,
    path: CAPTURE_INBOX_PATH,
    mode: "replace",
    content: updated,
    commitMessage: `Pocket Capture — delete capture ${params.id.slice(0, 8)}`,
  });
  if (!result.ok) {
    console.error("[captures] delete write failed", { ownerId: userId, error: result.error });
    return NextResponse.json({ error: "Could not delete capture" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sha: result.sha });
}
