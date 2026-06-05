import { createClient } from "@/lib/supabase/server";
import { signState } from "@/lib/crypto/encrypt";
import { GMAIL_SCOPES } from "@/lib/gmail";
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

  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL(`${CONNECTIONS_PAGE}?connection=not_configured`, request.url),
    );
  }

  const origin = new URL(request.url).origin;
  const callbackUrl = `${origin}/api/connections/gmail/callback`;

  const state = signState(
    JSON.stringify({
      userId: user.id,
      callbackUrl,
      nonce: crypto.randomBytes(16).toString("hex"),
      exp: Date.now() + 10 * 60 * 1000, // 10 minutes
    }),
  );

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GMAIL_SCOPES.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent"); // force a refresh_token on every connect
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
