// GET  /api/app/budget            → the owner's budget summary (cap + MTD spend + reset date + gate)
// PUT  /api/app/budget { budgetCents } | { reset: true }
//                                  → edit the cap (supersede chain) or reset to the tier default
//
// Settings → Budget (Cost Observability Phase 3, SPEC §5.6). Auth → the owner can only ever read/write
// their own budget (the lib scopes every query by the authed user id). Money in/out is whole-cent
// integers; the surface converts to dollars at display.

import { createClient } from "@/lib/supabase/server";
import {
  getBudgetSummary,
  setBudget,
  resetBudgetToTierDefault,
} from "@/lib/cost/budget";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Up to $100,000/mo — a generous Enterprise ceiling that still rejects fat-finger / overflow input.
const MAX_BUDGET_CENTS = 10_000_000;

const PutSchema = z.union([
  z.object({ reset: z.literal(true) }),
  z.object({ budgetCents: z.number().int().min(0).max(MAX_BUDGET_CENTS) }),
]);

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const summary = await getBudgetSummary(user.id);
    return NextResponse.json({ summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load budget";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof PutSchema>;
  try {
    input = PutSchema.parse((await req.json().catch(() => ({}))) as unknown);
  } catch (e) {
    const message =
      e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid request" : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if ("reset" in input) {
      await resetBudgetToTierDefault(user.id);
    } else {
      await setBudget(user.id, input.budgetCents);
    }
    const summary = await getBudgetSummary(user.id);
    return NextResponse.json({ summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update budget";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
