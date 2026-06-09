// POST /api/connectors/supabase/test
// Re-validate the stored PAT by listing the owner's organizations. A 401/403 flips the connection
// to status='error' so the card prompts a re-paste. Read-only; runs nothing destructive.

import { createClient } from "@/lib/supabase/server";
import { listOrganizations } from "@/lib/connectors/supabase/api";
import {
  fetchSupabaseConnectionFull,
  markSupabaseConnectionError,
} from "@/lib/pa-supabase-connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await fetchSupabaseConnectionFull(user.id);
  if (!conn.ok) return NextResponse.json({ error: conn.error }, { status: conn.status });
  if (!conn.data || conn.data.status === "revoked" || !conn.data.pat) {
    return NextResponse.json({ error: "Supabase isn't connected." }, { status: 409 });
  }

  const orgs = await listOrganizations(conn.data.pat);
  if (!orgs.ok) {
    if (orgs.authError) await markSupabaseConnectionError(conn.data.id);
    return NextResponse.json(
      {
        ok: false,
        error: orgs.authError
          ? "Your Supabase access token was rejected — re-paste it in Settings → Connections."
          : `Couldn't reach Supabase (${orgs.status}).`,
      },
      { status: orgs.authError ? 401 : 502 },
    );
  }

  return NextResponse.json({ ok: true, orgCount: orgs.data.length });
}
