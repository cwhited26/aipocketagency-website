// POST /api/app/onboarding/vertical — records the owner's vertical pick (PA-POS-22) and, when a
// brain is already connected (the login-with-no-vertical-set case), seeds the workspace in the
// same request. First-time buyers pick before a brain exists, so the seed defers and the
// brain-connect + Home-load triggers complete it (lib/onboarding/vertical-seed.ts).
//
// Body: { vertical: "coach" | ... | "sales-team" | null } — null is the explicit
// "Other / skip": decided, wants the empty workspace, never re-asked.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { VERTICAL_SLUGS, planVerticalSeed } from "@/lib/onboarding/verticals";
import { recordVerticalDecision, OnboardingDbError } from "@/lib/onboarding/state-db";
import { ensureVerticalSeed } from "@/lib/onboarding/vertical-seed";
import { onboardingLog } from "@/lib/onboarding/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  vertical: z.enum(VERTICAL_SLUGS).nullable(),
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
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }
  const { vertical } = parsed.data;

  const githubUsername =
    (user.user_metadata?.user_name as string | undefined) ?? user.email?.split("@")[0] ?? "owner";
  const plan = planVerticalSeed(vertical);

  try {
    await recordVerticalDecision({
      ownerId: user.id,
      githubUsername,
      vertical,
      suggestedAppIds: plan.apps,
    });
  } catch (e) {
    const status = e instanceof OnboardingDbError ? e.status : 500;
    onboardingLog.error("vertical decision write failed", {
      ownerId: user.id,
      vertical,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Could not save your pick. Try again." }, { status });
  }

  onboardingLog.info("vertical picked", { ownerId: user.id, vertical: vertical ?? "skip" });

  // Owners who already have a brain (picked at login, not first signup) get seeded right here.
  // Best-effort: a deferred/partial outcome is fine — the later triggers complete it.
  const seed = await ensureVerticalSeed(user.id);

  return NextResponse.json({ ok: true, seed: seed.status, created: seed.createdSlugs });
}
