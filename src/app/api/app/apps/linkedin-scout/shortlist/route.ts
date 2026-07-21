import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { canShortlist } from "@/lib/linkedin-scout/gate";
import { shortlistProspects } from "@/lib/linkedin-scout/orchestrate";
import { getRun, updateRunTotals } from "@/lib/linkedin-scout/db";
import { defaultComplete } from "@/lib/linkedin-scout/llm";
import { ShortlistSchema } from "@/lib/linkedin-scout/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Research + three drafts per prospect is real model work; give the batch room (matches the shipped
// Lead Scout draft-outreach route's inline pattern — no experimental after()).
export const maxDuration = 300;

// POST /api/app/apps/linkedin-scout/shortlist
// Promote the selected candidates to prospects and run research + drafts, staging each draft as its
// own Approval Queue card. Gated on the rolling-7d shortlist cap (SPEC §6).
export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = ShortlistSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });

  // The run must exist + belong to the owner.
  const run = await getRun(parsed.data.runId, user.id);
  if (!run.ok) return NextResponse.json({ error: run.error }, { status: run.status });
  if (!run.data) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  // Rolling-7d cap (SPEC §6) — enforced before any prospect is queued.
  const gate = await canShortlist(user.id, parsed.data.candidates.length);
  if (!gate.ok) return NextResponse.json({ error: "cap_reached", message: gate.reason }, { status: 429 });

  const paResult = await fetchPaUser(user.id);
  if (!paResult.ok) return NextResponse.json({ error: paResult.error }, { status: paResult.status });
  if (!paResult.data) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (!paResult.data.anthropic_api_key) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message:
          "Add your Anthropic API key in Settings — LinkedIn Scout researches each prospect and drafts the outreach in your voice with it.",
      },
      { status: 402 },
    );
  }

  const summary = await shortlistProspects({
    ownerId: user.id,
    runId: parsed.data.runId,
    input: parsed.data,
    complete: defaultComplete(paResult.data.anthropic_api_key),
    brainRepo: paResult.data.brain_repo,
    githubToken: paResult.data.github_token,
  });

  await updateRunTotals(parsed.data.runId, { shortlistCount: summary.prospects });

  return NextResponse.json(
    {
      prospects: summary.prospects,
      cardsQueued: summary.cardsQueued,
      cardsSkipped: summary.cardsSkipped,
      failures: summary.failures,
    },
    { status: 201 },
  );
}
