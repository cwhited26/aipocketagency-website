import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getLead } from "@/lib/leads/runs";
import { getSource } from "@/lib/leads/source";
import { draftOutreachForSingleLead } from "@/lib/leads/outreach";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tone: z.enum(["cold-introduce", "warm-followup", "reactivate"]).optional(),
});

// POST /api/app/apps/lead-scout/leads/[id]/draft-outreach
// Stage a single personalized outreach draft for one lead — the "Draft outreach for this lead" button.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof bodySchema> = {};
  const raw = await req.json().catch(() => null);
  if (raw !== null) {
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });
    body = parsed.data;
  }

  const leadResult = await getLead(params.id, user.id);
  if (!leadResult.ok) return NextResponse.json({ error: leadResult.error }, { status: leadResult.status });
  if (!leadResult.data) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const sourceResult = await getSource(leadResult.data.source_id, user.id);
  const sourceName = sourceResult.ok && sourceResult.data ? sourceResult.data.name : "Lead Scout";

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok) return NextResponse.json({ error: paResult.error }, { status: paResult.status });
  if (!paResult.data) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (!paResult.data.anthropic_api_key) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message: "Add your Anthropic API key in Settings — Lead Scout drafts outreach in your voice with it.",
      },
      { status: 402 },
    );
  }

  const result = await draftOutreachForSingleLead({
    leadId: params.id,
    ownerId: user.id,
    paUser: paResult.data,
    sourceName,
    tone: body.tone,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ staged: result.data }, { status: 201 });
}
