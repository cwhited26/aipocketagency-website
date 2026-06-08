import { createClient } from "@/lib/supabase/server";
import { disconnectLeadScoutConnection } from "@/lib/pa-lead-scout-connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Disconnect Bright Data — flips the connection to revoked and clears the stored key.
export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await disconnectLeadScoutConnection(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ status: "revoked" });
}
