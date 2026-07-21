import { createClient } from "@/lib/supabase/server";
import { getProspect, listDraftsForProspect } from "@/lib/linkedin-scout/db";
import { executeLinkedinScoutSend } from "@/lib/linkedin-scout/execute";
import { maybeProposeLinkedinSkills } from "@/lib/linkedin-scout/skills";
import { isDraftKind } from "@/lib/linkedin-scout/types";
import type { LinkedinScoutSendPayload } from "@/lib/linkedin-scout/queue";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ kind: z.string() });

// POST /api/app/apps/linkedin-scout/prospects/[id]/execute  { kind }
// The direct Browser-Agent hand-off for one of a prospect's drafts (SPEC §12.4). The primary approval
// path is the /agent Approval Queue card; this is the App-surface trigger. NEVER auto-sends without
// this explicit call, and every call is one send (SPEC §11).
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isDraftKind(parsed.data.kind)) {
    return NextResponse.json({ error: "kind must be connection_note | day3_inmail | day7_followup" }, { status: 422 });
  }

  const prospectRes = await getProspect(params.id, user.id);
  if (!prospectRes.ok) return NextResponse.json({ error: prospectRes.error }, { status: prospectRes.status });
  if (!prospectRes.data) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const draftsRes = await listDraftsForProspect(params.id, user.id);
  if (!draftsRes.ok) return NextResponse.json({ error: draftsRes.error }, { status: draftsRes.status });
  const draft = draftsRes.data.find((d) => d.kind === parsed.data.kind);
  if (!draft) return NextResponse.json({ error: `No ${parsed.data.kind} draft for this prospect` }, { status: 404 });

  const payload: LinkedinScoutSendPayload = {
    prospectId: prospectRes.data.id,
    draftId: draft.id,
    kind: draft.kind,
    linkedinProfileUrl: prospectRes.data.linkedin_profile_url,
    fullName: prospectRes.data.full_name,
    body: draft.body,
    voiceFlags: draft.voice_flags,
  };

  const outcome = await executeLinkedinScoutSend(user.id, payload);
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });

  // Best-effort LEARN-phase Skill proposal once acceptance data accrues — never breaks the send.
  await maybeProposeLinkedinSkills(user.id).catch(() => ({ proposed: [], skipped: [] }));

  if (!outcome.dispatched) {
    return NextResponse.json({
      status: "queued",
      dispatched: false,
      reason: "receiver_missing",
      message:
        "Approved and queued. The send fires on your own LinkedIn tab the moment the Browser Agent runtime is connected — nothing was auto-sent.",
    });
  }
  return NextResponse.json({ status: "sent", dispatched: true, kind: outcome.kind });
}
