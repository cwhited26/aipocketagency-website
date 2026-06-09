import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getRun } from "@/lib/leads/runs";
import { getSource } from "@/lib/leads/source";
import { generateOutreachForBatch } from "@/lib/leads/outreach";
import { LEAD_CLASSIFICATIONS, type LeadClassification } from "@/lib/leads/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  // Which buckets to draft for; defaults to hot + warm when absent.
  classification: z.array(z.enum(LEAD_CLASSIFICATIONS as unknown as [string, ...string[]])).optional(),
  tone: z.enum(["cold-introduce", "warm-followup", "reactivate"]).optional(),
});

// POST /api/app/apps/lead-scout/runs/[id]/draft-outreach
// Stage personalized outreach drafts in Mission Control for the run's hot + warm leads (Phase 3).
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

  const runResult = await getRun(params.id, user.id);
  if (!runResult.ok) return NextResponse.json({ error: runResult.error }, { status: runResult.status });
  if (!runResult.data) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const sourceResult = await getSource(runResult.data.source_id, user.id);
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

  const batch = await generateOutreachForBatch({
    runId: params.id,
    ownerId: user.id,
    paUser: paResult.data,
    sourceName,
    classification: body.classification as LeadClassification[] | undefined,
    tone: body.tone,
  });
  if (!batch.ok) return NextResponse.json({ error: batch.error }, { status: batch.status });

  return NextResponse.json(
    {
      count: batch.data.staged.length,
      skipped: batch.data.skipped,
      candidates: batch.data.candidates,
      previews: batch.data.staged.slice(0, 3).map((d) => ({
        leadName: d.leadName,
        recipient: d.recipient,
        subject: d.subject,
        preview: d.bodyPreview,
      })),
    },
    { status: 201 },
  );
}
