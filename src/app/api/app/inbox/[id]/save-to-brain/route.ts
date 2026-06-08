import { createClient } from "@/lib/supabase/server";
import { fetchInboxItemById, resolveInboxItem } from "@/lib/pa-inbox-items";
import { fetchPaUser } from "@/lib/pa-supabase";
import { commitMemoryFile } from "@/lib/pa-brain";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// Save a routine output (Daily Brief / Weekly Digest / Follow-up Sweep summary) into
// the owner's brain as a knowledge memory, then mark it read. This is the "Save to
// brain" secondary affordance on the routine_output card — informational items are
// never "approved"; keeping one is an explicit, separate choice.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const found = await fetchInboxItemById(id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  const item = found.data;
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Ownership gate (RLS is defense-in-depth; this is the real gate).
  if (item.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only informational routine outputs can be saved to brain. Anything else has its
  // own approval path and must not be silently committed here.
  if (item.kind !== "routine_output") {
    return NextResponse.json(
      { error: "Only routine outputs can be saved to your brain." },
      { status: 422 },
    );
  }

  const content = item.body_md ?? str(item.payload.content);
  if (!content.trim()) {
    return NextResponse.json({ error: "Nothing to save — this output is empty." }, { status: 422 });
  }

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok || !paResult.data) {
    return NextResponse.json({ error: "User record not found." }, { status: 404 });
  }
  const { brain_repo, github_token } = paResult.data;
  if (!brain_repo || !github_token) {
    return NextResponse.json(
      { error: "Connect your brain repo in Settings to save outputs to it." },
      { status: 409 },
    );
  }

  const routineKind = str(item.payload.routineKind) || "routine";
  const date = item.created_at.slice(0, 10); // YYYY-MM-DD from the row's created_at
  const slug = routineKind.replace(/_/g, "-");
  const path = `memory/learning/${slug}-${date}.md`;
  const frontmatter =
    `---\nname: ${slug}-${date}\n` +
    `description: ${item.title}\n` +
    `metadata:\n  type: reference\n---\n`;
  const fileBody = `${frontmatter}\n# ${item.title}\n\n${content.trim()}\n`;

  const commit = await commitMemoryFile({
    repo: brain_repo,
    token: github_token,
    path,
    mode: "replace",
    content: fileBody,
    commitMessage: `Pocket Agent — save ${item.title} to brain`,
  });
  if (!commit.ok) {
    return NextResponse.json({ error: commit.error }, { status: 502 });
  }

  // Saved — mark it read so it leaves the pending queue.
  const resolved = await resolveInboxItem(id, "approved", user.id);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  return NextResponse.json({ ok: true, memoryPath: path, sha: commit.sha });
}
