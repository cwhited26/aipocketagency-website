// GET /api/app/pocket-capture/inbound-config — return the signed-in user's Email Forward address
// (PC-CORE-2). Lazily provisions the per-user slug on first read, then returns
// { email: "<slug>@capture.aipocketagent.com" }. The dashboard UI that surfaces this address for
// copy-to-contacts is PC-CORE-6's job; this lane only exposes the value.

import { createClient } from "@/lib/supabase/server";
import { ensureCaptureEmailSlug } from "@/lib/pocket-capture/slug";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await ensureCaptureEmailSlug(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ email: result.data.email });
}
