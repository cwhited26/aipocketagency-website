import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent, commitMemoryFile, deleteRepoFile } from "@/lib/pa-brain";
import { removeEntryFromRaw } from "@/lib/pa-inbox";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// An item can be removed one of two ways depending on how it was captured:
//  • { id }   → a PA-INBOX block inside memory/inbox.md (endpoint capture)
//  • { path } → a standalone file: sessions/inbox/ (iOS Working Copy share) or
//               inbox/voice-memos/ (in-app voice recorder)
const RemoveBodySchema = z.union([
  z.object({ id: z.string().uuid("Entry id must be a UUID") }),
  z.object({
    path: z
      .string()
      .min(1)
      .regex(/^(sessions\/inbox|inbox\/voice-memos)\/.+\.md$/, "Invalid inbox file path"),
  }),
]);

// POST /api/app/brain/inbox  { id } | { path }
// Removes one captured item — a block from memory/inbox.md, or a sessions/inbox file.
export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof RemoveBodySchema>;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    body = RemoveBodySchema.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body — id (UUID) or sessions/inbox path required" },
      { status: 400 },
    );
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "User record not found" }, { status: 404 });
  }
  const paUser = paResult.data;

  const { data: { session } } = await supabase.auth.getSession();
  const ghToken = paUser.github_token ?? session?.provider_token ?? null;

  if (!paUser.brain_repo || !ghToken) {
    return NextResponse.json({ error: "No brain repo connected" }, { status: 400 });
  }

  // File-backed entry (iOS share): delete the file.
  if ("path" in body) {
    const result = await deleteRepoFile({
      repo: paUser.brain_repo,
      token: ghToken,
      path: body.path,
      commitMessage: `Pocket Agent — remove inbox item ${body.path.split("/").pop() ?? ""}`,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({ ok: true, sha: result.sha });
  }

  // Block entry (endpoint capture): rewrite memory/inbox.md without it.
  const inboxPath = "memory/inbox.md";
  const existing = await fetchFileContent(paUser.brain_repo, inboxPath, ghToken);
  const updated = removeEntryFromRaw(existing, body.id);

  const commitResult = await commitMemoryFile({
    repo: paUser.brain_repo,
    token: ghToken,
    path: inboxPath,
    mode: "replace",
    content: updated,
    commitMessage: `Pocket Agent — remove inbox entry ${body.id.slice(0, 8)}`,
  });

  if (!commitResult.ok) {
    return NextResponse.json({ error: commitResult.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sha: commitResult.sha });
}
