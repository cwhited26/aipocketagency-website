import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto/encrypt";
import { revokeToken } from "@/lib/connectors/calendly/oauth";
import {
  fetchCalendlyConnectionFull,
  revokeCalendlyConnection,
} from "@/lib/pa-calendly-connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Best-effort revoke at Calendly before we wipe the stored token.
  const found = await fetchCalendlyConnectionFull(user.id);
  if (found.ok && found.data?.refresh_token_encrypted) {
    try {
      await revokeToken(decrypt(found.data.refresh_token_encrypted));
    } catch {
      // Decrypt/revoke failure is non-fatal — we still soft-delete the row below.
    }
  }

  const result = await revokeCalendlyConnection(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
