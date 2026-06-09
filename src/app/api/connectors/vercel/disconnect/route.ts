// POST /api/connectors/vercel/disconnect
// Revoke the owner's Vercel connection — flip the row to `revoked` and wipe the stored token from
// config. The Vercel-side token is not deleted (PA can't, and the owner may reuse it); this just
// removes PA's copy. Mirrors the Lead Scout disconnect.

import { createClient } from "@/lib/supabase/server";
import { disconnectVercelConnection } from "@/lib/pa-vercel-connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await disconnectVercelConnection(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ status: "revoked" });
}
