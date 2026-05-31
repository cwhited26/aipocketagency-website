import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent, commitMemoryFile } from "@/lib/pa-brain";
import { removeEntryFromRaw } from "@/lib/pa-inbox";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RemoveBodySchema = z.object({
  id: z.string().uuid("Entry id must be a UUID"),
});

// POST /api/app/brain/inbox  { id: string }
// Removes one entry from memory/inbox.md by id and commits the result.
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
    return NextResponse.json({ error: "Invalid request body — id (UUID) required" }, { status: 400 });
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
