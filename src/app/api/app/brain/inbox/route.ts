import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { fetchFileContent, commitMemoryFile, deleteRepoFile } from "@/lib/pa-brain";
import { removeEntryFromRaw } from "@/lib/pa-inbox";
import { absorbToMemory, assetPathFor } from "@/lib/brain/absorb";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHARE_FILE_RE = /^sessions\/inbox\/.+\.md$/;

// This handler triages the share-extension lifecycle. Two write actions:
//  • { promote } → copy a sessions/inbox/<file> into assets/<file> and absorb it into memory,
//                  so the canonical capture (Documents visibility + agent-readable) happens
//                  automatically while the sessions/inbox artifact stays put for triage.
//  • { id } | { path } → remove one captured item once triaged:
//      { id }   → a PA-INBOX block inside memory/inbox.md (endpoint capture)
//      { path } → a standalone file: sessions/inbox/ (iOS share) or inbox/voice-memos/ (voice)
const BodySchema = z.union([
  z.object({
    promote: z.string().min(1).regex(SHARE_FILE_RE, "Invalid share file path"),
  }),
  z.object({ id: z.string().uuid("Entry id must be a UUID") }),
  z.object({
    path: z
      .string()
      .min(1)
      .regex(/^(sessions\/inbox|inbox\/voice-memos)\/.+\.md$/, "Invalid inbox file path"),
  }),
]);

// POST /api/app/brain/inbox  { promote } | { id } | { path }
export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    body = BodySchema.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body — promote/path (sessions/inbox) or id (UUID) required" },
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

  // Promote a share-extension file into assets/ + memory (idempotent: skip if already there).
  if ("promote" in body) {
    const sharePath = body.promote;
    const fileName = sharePath.split("/").pop() ?? "share.md";
    const assetPath = assetPathFor(fileName);

    const existingAsset = await fetchFileContent(paUser.brain_repo, assetPath, ghToken);
    if (existingAsset) {
      return NextResponse.json({ ok: true, assetPath, absorbed: false, alreadyPromoted: true });
    }

    const raw = await fetchFileContent(paUser.brain_repo, sharePath, ghToken);
    if (!raw) {
      return NextResponse.json({ error: "Share file not found or empty" }, { status: 404 });
    }

    const result = await absorbToMemory({
      repo: paUser.brain_repo,
      token: ghToken,
      anthropicApiKey: paUser.anthropic_api_key,
      fileName,
      mimeType: "text/markdown",
      buffer: Buffer.from(raw, "utf-8"),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      assetPath: result.assetPath,
      absorbed: result.absorbed,
      ...(result.memoryPath ? { memoryPath: result.memoryPath } : {}),
    });
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
