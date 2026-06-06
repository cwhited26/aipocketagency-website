// POST /api/orchestrator/dispatch  { goal, originatingMessageId? }
// The orchestrator entry point. Auth → Zod → dispatchUserGoal. Returns the typed outcome
// (simple / dispatched / capped / disabled) so the chat surface renders the right card +
// upgrade CTA. Never executes anything here — the dispatcher persists the run + fires it at
// the Modal runtime; execution streams back via the webhook.

import { createClient } from "@/lib/supabase/server";
import { dispatchUserGoal } from "@/lib/orchestrator/dispatcher";
import { OrchestratorDbError } from "@/lib/orchestrator/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DispatchSchema = z.object({
  goal: z.string().min(1, "Goal is empty").max(50_000),
  originatingMessageId: z.string().uuid().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input: z.infer<typeof DispatchSchema>;
  try {
    const raw = (await req.json().catch(() => ({}))) as unknown;
    input = DispatchSchema.parse(raw);
  } catch (e) {
    const message =
      e instanceof z.ZodError ? e.issues[0]?.message ?? "Invalid request" : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const outcome = await dispatchUserGoal({
      businessId: user.id,
      goal: input.goal,
      originatingMessageId: input.originatingMessageId ?? null,
    });
    return NextResponse.json({ outcome });
  } catch (e) {
    const status = e instanceof OrchestratorDbError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Dispatch failed";
    return NextResponse.json({ error: message }, { status });
  }
}
