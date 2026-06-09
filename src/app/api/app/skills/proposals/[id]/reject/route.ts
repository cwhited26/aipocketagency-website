// POST /api/app/skills/proposals/[id]/reject
//
// Reject a LEARN-phase Skill proposal. Nothing is written to the brain. The rejection is recorded
// (status='rejected') so the LEARN phase won't re-propose the same Skill write (isProposalSuppressed).
// Auth-only — a reject must work even if the brain isn't reachable.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchInboxItemById, resolveInboxItem } from "@/lib/pa-inbox-items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const found = await fetchInboxItemById(params.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  const item = found.data;
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.user_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.kind !== "skill_evolution_proposal") {
    return NextResponse.json({ error: "Not a skill proposal" }, { status: 400 });
  }
  if (item.status === "rejected") {
    return NextResponse.json({ status: "rejected", alreadyResolved: true });
  }
  if (item.status !== "pending") {
    return NextResponse.json({ error: `Cannot reject an item that is '${item.status}'.` }, { status: 409 });
  }

  const resolved = await resolveInboxItem(params.id, "rejected", user.id);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  return NextResponse.json({ status: "rejected" });
}
