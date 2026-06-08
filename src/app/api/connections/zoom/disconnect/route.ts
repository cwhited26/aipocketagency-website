import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto/encrypt";
import { revokeToken, zoomOAuthConfig } from "@/lib/connectors/zoom/oauth";
import { fetchZoomConnectionFull, revokeZoomConnection } from "@/lib/pa-zoom-connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Best-effort revoke at Zoom before we wipe the stored token. A failure here is non-fatal — the
  // row is soft-deleted regardless.
  const found = await fetchZoomConnectionFull(user.id);
  const config = zoomOAuthConfig();
  if (found.ok && found.data?.refresh_token_encrypted && config) {
    try {
      await revokeToken(decrypt(found.data.refresh_token_encrypted), config);
    } catch {
      // Decrypt/revoke failure is non-fatal — we still soft-delete the row below.
    }
  }

  const result = await revokeZoomConnection(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
