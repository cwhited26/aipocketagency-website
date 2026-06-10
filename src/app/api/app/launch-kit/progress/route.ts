// POST /api/app/launch-kit/progress  { step_slug, completed }
// Mark a Launch Kit checklist step complete or un-complete (PA-LAUNCHKIT-IMPL-6). Owner-scoped.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isLaunchKitStepSlug } from "@/lib/launch-kit/steps";
import { markStepComplete, unmarkStep } from "@/lib/launch-kit/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  step_slug: z.string(),
  completed: z.boolean(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse((await req.json().catch(() => ({}))) as unknown);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!isLaunchKitStepSlug(body.step_slug)) {
    return NextResponse.json({ error: "Unknown step" }, { status: 404 });
  }

  const res = body.completed
    ? await markStepComplete({ ownerId: user.id, stepSlug: body.step_slug })
    : await unmarkStep({ ownerId: user.id, stepSlug: body.step_slug });
  if (!res.ok) {
    console.error("[launch-kit/progress] write failed", {
      user_id: user.id,
      step_slug: body.step_slug,
      completed: body.completed,
      status: res.status,
      error: res.error,
    });
    return NextResponse.json({ error: "Could not save. Try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
