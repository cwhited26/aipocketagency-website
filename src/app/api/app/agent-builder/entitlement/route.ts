// GET /api/app/agent-builder/entitlement — tells the marketing compose boxes (the homepage
// hero + the /agents Library input) where their "Compose →" should land. PA-POS-34: every
// signed-in owner composes — the compose primitive has no tier gate; the tier gate applies to
// the composed spec's Apps at review time. Signed-in → /agents#compose runs the real flow;
// signed-out → the spec rides into signup at /start?intent=agent-builder.

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return NextResponse.json({ entitled: Boolean(user) });
}
