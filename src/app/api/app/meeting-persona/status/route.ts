// GET /api/app/meeting-persona/status → { connected, verified_at }
//
// Owner-facing connection state for the Settings card. Never returns the encrypted key.

import { createClient } from "@/lib/supabase/server";
import { fetchRecallConnectionPublic } from "@/lib/connectors/recall-ai/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await fetchRecallConnectionPublic(user.id);
  if (!conn.ok) return NextResponse.json({ error: conn.error }, { status: conn.status });

  return NextResponse.json({ connected: conn.data.connected, verified_at: conn.data.verifiedAt });
}
