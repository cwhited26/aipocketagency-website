// POST /api/app/pocket-capture/onboarding/complete — mark the signed-in Pocket Capture buyer's
// onboarding wizard finished/skipped (PC-MARK-3, step 4). Idempotent: the first completion timestamp
// sticks across re-submits. The /app/captures dashboard (PC-CORE-6) reads the timestamp to stop
// redirecting the buyer back into onboarding.

import { createClient } from "@/lib/supabase/server";
import { isPocketCaptureUser } from "@/lib/pocket-capture/entitlement";
import { markOnboardingCompleted } from "@/lib/pocket-capture/onboarding";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entitled = await isPocketCaptureUser({ userId: user.id, email: user.email ?? null });
  if (!entitled.ok) return NextResponse.json({ error: entitled.error }, { status: entitled.status });
  if (!entitled.data) return NextResponse.json({ error: "Not a Pocket Capture account" }, { status: 403 });

  const marked = await markOnboardingCompleted(user.id);
  if (!marked.ok) return NextResponse.json({ error: marked.error }, { status: marked.status });

  return NextResponse.json({ completed_at: marked.data.completedAt });
}
