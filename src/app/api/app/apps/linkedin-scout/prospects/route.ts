import { createClient } from "@/lib/supabase/server";
import { listProspects, listDraftsForOwner } from "@/lib/linkedin-scout/db";
import { CONNECTION_STATUSES, type ConnectionStatus } from "@/lib/linkedin-scout/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/app/apps/linkedin-scout/prospects?status=<connection_status>
// List this owner's prospects (newest first), optionally filtered by connection_status, each with its
// drafts attached for the Prospects tab's expanded row.
export async function GET(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status: ConnectionStatus | undefined =
    statusParam && (CONNECTION_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as ConnectionStatus)
      : undefined;

  const [prospectsRes, draftsRes] = await Promise.all([
    listProspects(user.id, status ? { status } : undefined),
    listDraftsForOwner(user.id),
  ]);
  if (!prospectsRes.ok) return NextResponse.json({ error: prospectsRes.error }, { status: prospectsRes.status });
  const drafts = draftsRes.ok ? draftsRes.data : [];

  const draftsByProspect = new Map<string, typeof drafts>();
  for (const d of drafts) {
    const list = draftsByProspect.get(d.prospect_id) ?? [];
    list.push(d);
    draftsByProspect.set(d.prospect_id, list);
  }

  return NextResponse.json({
    prospects: prospectsRes.data.map((p) => ({
      id: p.id,
      linkedinProfileUrl: p.linkedin_profile_url,
      fullName: p.full_name,
      headline: p.headline,
      company: p.company,
      fitScore: p.fit_score,
      enrichmentSource: p.enrichment_source,
      brief: p.brief,
      connectionStatus: p.connection_status,
      day3InmailStatus: p.day3_inmail_status,
      day7FollowupStatus: p.day7_followup_status,
      createdAt: p.created_at,
      drafts: (draftsByProspect.get(p.id) ?? []).map((d) => ({
        id: d.id,
        kind: d.kind,
        body: d.body,
        voiceFlags: d.voice_flags,
        executedAt: d.executed_at,
      })),
    })),
  });
}
