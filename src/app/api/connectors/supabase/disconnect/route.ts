// POST /api/connectors/supabase/disconnect
// Revoke the connection: status='revoked' + wipe the encrypted PAT. The row is retained for
// history; the owner can reconnect by pasting a fresh token.

import { createClient } from "@/lib/supabase/server";
import { revokeSupabaseConnection } from "@/lib/pa-supabase-connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await revokeSupabaseConnection(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ status: "disconnected" });
}
