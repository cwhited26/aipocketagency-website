import { createClient } from "@/lib/supabase/server";
import { initPaUser } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const displayName =
    (user.user_metadata?.user_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "user";

  const result = await initPaUser({ id: user.id, github_username: displayName });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
