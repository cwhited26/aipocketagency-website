import { createClient } from "@/lib/supabase/server";
import { signState } from "@/lib/crypto/encrypt";
import { zoomOAuthConfig, buildZoomAuthorizeUrl } from "@/lib/connectors/zoom/oauth";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNECTIONS_PAGE = "/app/settings/connections";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/app/login?next=${encodeURIComponent(CONNECTIONS_PAGE)}`, request.url),
    );
  }

  // Zoom User-level OAuth: client id + secret on Vercel (ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET).
  // Their absence is the "not configured" state → a clean message, never a crash. Scopes are
  // configured on the Zoom app in the Marketplace, not passed on the URL.
  const config = zoomOAuthConfig();
  if (!config) {
    return NextResponse.redirect(new URL(`${CONNECTIONS_PAGE}?zoom=not_configured`, request.url));
  }

  const state = signState(
    JSON.stringify({
      userId: user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
      exp: Date.now() + 10 * 60 * 1000, // 10 minutes
    }),
  );

  return NextResponse.redirect(buildZoomAuthorizeUrl(config.clientId, state));
}
