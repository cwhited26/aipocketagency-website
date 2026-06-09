// POST /api/app/budget/decision { decision: 'keep_going' | 'pause' }
//
// Persists the owner's soft-pause choice for the current period (Cost Observability Phase 4, SPEC §5.4,
// PA-COST-13). This is the back of the three-button 80% warn:
//   • keep_going → acknowledge the warn; the dispatcher stops re-prompting this month (still gates at 100%)
//   • pause      → pause new background agent runs for the rest of the period (every new dispatch gates)
// ("Raise the cap" isn't a decision — it edits the budget via PUT /api/app/budget, which lifts the gate.)

import { createClient } from "@/lib/supabase/server";
import { recordPeriodDecision, getBudgetSummary } from "@/lib/cost/budget";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DecisionSchema = z.object({
  decision: z.enum(["keep_going", "pause"]),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof DecisionSchema>;
  try {
    input = DecisionSchema.parse((await req.json().catch(() => ({}))) as unknown);
  } catch (e) {
    const message =
      e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid request" : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await recordPeriodDecision(user.id, input.decision);
    const summary = await getBudgetSummary(user.id);
    return NextResponse.json({ summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to record decision";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
