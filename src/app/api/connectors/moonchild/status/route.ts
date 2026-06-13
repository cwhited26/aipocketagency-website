// GET /api/connectors/moonchild/status
// Returns the owner's Moonchild connection state for the wizard "Pull from my Moonchild project"
// option in the LPB wizard. No token in the response — status + accountLabel only. (PA-LPB-13)

import { createClient } from "@/lib/supabase/server";
import { fetchMoonchildConnectionPublic } from "@/lib/pa-moonchild-connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await fetchMoonchildConnectionPublic(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const conn = result.data;
  return NextResponse.json({
    connected: conn !== null && conn.status === "active" && conn.hasToken,
    status: conn?.status ?? null,
    accountLabel: conn?.accountLabel ?? null,
  });
}
