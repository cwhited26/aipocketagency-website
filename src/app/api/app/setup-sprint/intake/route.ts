// POST /api/app/setup-sprint/intake  { business_name, offerings, target_customer, current_admin_pain, top_workflows[] }
// Submit the owner's pre-call intake for their Setup Sprint (PA-SPRINT-3). Owner-scoped; advances the
// sprint's current_step to 'intake_submitted'.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fetchSprintForOwner, submitIntake } from "@/lib/setup-sprint/sprints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IntakeSchema = z.object({
  business_name: z.string().trim().min(1).max(200),
  offerings: z.string().trim().min(1).max(4000),
  target_customer: z.string().trim().min(1).max(2000),
  current_admin_pain: z.string().trim().min(1).max(2000),
  top_workflows: z.array(z.string().trim().min(1).max(400)).min(1).max(3),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof IntakeSchema>;
  try {
    body = IntakeSchema.parse((await req.json().catch(() => ({}))) as unknown);
  } catch {
    return NextResponse.json({ error: "Please fill every field." }, { status: 400 });
  }

  // Only owners who actually have a sprint can submit intake.
  const sprint = await fetchSprintForOwner(user.id);
  if (!sprint.ok) {
    return NextResponse.json({ error: "Could not load your sprint. Try again." }, { status: 502 });
  }
  if (!sprint.data) {
    return NextResponse.json({ error: "No active Setup Sprint on your account." }, { status: 404 });
  }

  const res = await submitIntake({ ownerId: user.id, intake: body });
  if (!res.ok) {
    console.error("[setup-sprint/intake] submit failed", {
      user_id: user.id,
      status: res.status,
      error: res.error,
    });
    return NextResponse.json({ error: "Could not save. Try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
