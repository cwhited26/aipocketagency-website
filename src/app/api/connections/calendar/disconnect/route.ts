import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto/encrypt";
import { revokeToken } from "@/lib/connectors/calendar/oauth";
import {
  fetchCalendarConnectionFull,
  revokeCalendarConnection,
} from "@/lib/pa-calendar-connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Best-effort revoke at Google before we wipe the stored token. Calendar is its own grant, so
  // revoking it never touches the Gmail connection.
  const found = await fetchCalendarConnectionFull(user.id);
  if (found.ok && found.data?.refresh_token_encrypted) {
    try {
      await revokeToken(decrypt(found.data.refresh_token_encrypted));
    } catch {
      // Decrypt/revoke failure is non-fatal — we still soft-delete the row below.
    }
  }

  const result = await revokeCalendarConnection(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
