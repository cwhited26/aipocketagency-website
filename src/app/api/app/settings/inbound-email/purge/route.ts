// POST /api/app/settings/inbound-email/purge — hard-delete one inbound-email capture from the
// brain. Removes the brain file (BCC touchpoint log), purges any thread-watch tied to that
// email's subject, and marks the log entry purged. Owner-gated.

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { deleteBrainFile } from "@/lib/brain/absorb";
import { fetchInboundLogById, markInboundLogPurged } from "@/lib/inbound-email/log";
import { purgeWatchesBySubject } from "@/lib/inbound-email/bcc-watch";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ logId: z.string().min(1).max(100) });

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  const found = await fetchInboundLogById(parsed.data.logId);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  const entry = found.data;
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Ownership gate (RLS is defense-in-depth; this is the real gate).
  if (entry.owner_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 1. Hard-delete the brain capture, if one was written.
  if (entry.brain_path) {
    const paResult = await fetchPaUser(user.id);
    const paUser = paResult.ok ? paResult.data : null;
    if (paUser?.brain_repo && paUser.github_token) {
      const deleted = await deleteBrainFile({
        repo: paUser.brain_repo,
        token: paUser.github_token,
        path: entry.brain_path,
        commitMessage: `Pocket Agent — purge logged email at owner's request`,
      });
      if (!deleted.ok) {
        return NextResponse.json(
          { error: `Couldn't delete the brain file: ${deleted.error}` },
          { status: 502 },
        );
      }
    }
  }

  // 2. Purge the thread-watch(es) for this email's subject (BCC captures).
  if (entry.subject) {
    const purged = await purgeWatchesBySubject(user.id, entry.subject);
    if (!purged.ok) return NextResponse.json({ error: purged.error }, { status: purged.status });
  }

  // 3. Mark the log entry purged (clears the stored brain_path).
  const marked = await markInboundLogPurged(entry.id);
  if (!marked.ok) return NextResponse.json({ error: marked.error }, { status: marked.status });

  return NextResponse.json({ ok: true });
}
