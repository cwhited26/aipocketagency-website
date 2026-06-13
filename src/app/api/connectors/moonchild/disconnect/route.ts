// DELETE /api/connectors/moonchild/disconnect
// Revoke the owner's Moonchild BYO connection. Clears the stored token and flips status to revoked.
// (PA-LPB-13)

import { createClient } from "@/lib/supabase/server";
import { disconnectMoonchildConnection } from "@/lib/pa-moonchild-connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await disconnectMoonchildConnection(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ status: "revoked" });
}
