// POST /api/app/decisions/[id]/verdict — the owner accepts (with edits), rejects, or asks to re-run the
// Moderator's verdict (PA-DR-4). Save writes the transcript + verdict to brain/decisions/ via the
// supersede-chain (PA-DR-5) and flips the row to saved. Reject logs the reason for trigger calibration.
// Re-run is a client-driven restart (a fresh /start with new context) — acked here, no mutation, so the
// prior verdict stays in history and the disagreement is surfaced, never silently overwritten (§11).

import { createClient } from "@/lib/supabase/server";
import { fetchPaUser } from "@/lib/pa-supabase";
import { getRoundtable, getTurns, updateRoundtable } from "@/lib/decisions/db";
import { parseVerdict } from "@/lib/decisions/roles";
import { writeVerdictToBrain } from "@/lib/decisions/brain";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), recommendation: z.string().min(1).max(20_000) }),
  z.object({ action: z.literal("reject"), reason: z.string().min(1).max(2_000) }),
  z.object({ action: z.literal("rerun") }),
]);

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
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

  const rt = await getRoundtable(params.id, user.id);
  if (!rt.ok) return NextResponse.json({ error: rt.error }, { status: rt.status });
  if (!rt.data) return NextResponse.json({ error: "Roundtable not found" }, { status: 404 });
  const roundtable = rt.data;

  if (parsed.data.action === "rerun") {
    // No mutation — the client starts a fresh roundtable. This one stays viewable in history.
    return NextResponse.json({ ok: true, action: "rerun" });
  }

  if (parsed.data.action === "reject") {
    const upd = await updateRoundtable(params.id, user.id, {
      status: "rejected",
      rejectionReason: parsed.data.reason.trim(),
    });
    if (!upd.ok) return NextResponse.json({ error: upd.error }, { status: upd.status });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // Save — only meaningful once the Moderator has run.
  if (roundtable.status !== "verdict_ready" && roundtable.status !== "saved") {
    return NextResponse.json({ error: "The verdict isn't ready to save yet." }, { status: 409 });
  }

  const turns = await getTurns(params.id, user.id);
  if (!turns.ok) return NextResponse.json({ error: turns.error }, { status: turns.status });
  const moderator = turns.data.find((t) => t.role === "moderator");
  const verdict = moderator ? parseVerdict(moderator.content) : { recommendation: "", strongestDissent: "", supportingEvidence: "" };

  const paResult = await fetchPaUser(user.id);
  const brainRepo = paResult.ok ? paResult.data?.brain_repo ?? null : null;
  const githubToken = paResult.ok ? paResult.data?.github_token ?? null : null;

  let brainPath: string | null = null;
  let brainNote: string | null = null;
  if (brainRepo && githubToken) {
    const rolesUsed = Array.from(
      new Set(turns.data.filter((t) => t.role !== "owner_interjection").map((t) => t.role)),
    );
    const write = await writeVerdictToBrain(brainRepo, githubToken, {
      question: roundtable.question,
      verdict,
      savedRecommendation: parsed.data.recommendation,
      decisionType: roundtable.decision_type,
      stakesLevel: roundtable.stakes_level,
      rolesUsed,
      modelBackings: roundtable.model_backings,
      turns: turns.data,
    });
    if (write.ok) brainPath = write.path;
    else brainNote = `Saved, but writing to your brain failed: ${write.error}`;
  } else {
    brainNote = "Saved. Connect your brain to keep this verdict as a precedent for next time.";
  }

  const upd = await updateRoundtable(params.id, user.id, {
    status: "saved",
    verdict: parsed.data.recommendation.trim(),
    verdictBrainPath: brainPath,
    savedAt: new Date().toISOString(),
  });
  if (!upd.ok) return NextResponse.json({ error: upd.error }, { status: upd.status });

  return NextResponse.json({ ok: true, status: "saved", brainPath, brainNote });
}
