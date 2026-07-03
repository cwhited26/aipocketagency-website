// POST /api/app/onboarding/steps/skip — the ONE manual write on the PA-POS-36 checklist, and it
// is an opt-out, not a claim of work: the teammate invite is optional on Personal Brain
// (starter), where a solo owner has nobody to invite. Only steps the registry marks
// skippableOnStarter accept a skip, and only at the starter tier — every other completion is
// detected server-side by the action itself. Starter never gets credits, so a skip can't farm a
// bonus by design. (Distinct from /api/app/onboarding/skip, the Phase-1a brain-onboarding skip.)

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getOnboardingStep, ONBOARDING_STEP_SLUGS } from "@/data/onboarding-steps";
import { markOnboardingStepComplete } from "@/lib/onboarding/progress";
import { getCurrentTier } from "@/lib/personas/tier-caps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  step: z.enum(ONBOARDING_STEP_SLUGS),
});

export async function POST(req: Request): Promise<NextResponse> {
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
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const step = getOnboardingStep(parsed.data.step);
  if (!step.skippableOnStarter) {
    return NextResponse.json({ error: "This step completes by doing it." }, { status: 422 });
  }
  const tier = await getCurrentTier(user.id);
  if (tier !== "starter") {
    return NextResponse.json({ error: "This step completes by doing it." }, { status: 422 });
  }

  await markOnboardingStepComplete(user.id, step.slug);
  return NextResponse.json({ skipped: step.slug });
}
