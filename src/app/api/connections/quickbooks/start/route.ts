import { createClient } from "@/lib/supabase/server";
import { signState } from "@/lib/crypto/encrypt";
import {
  buildQuickBooksAuthorizeUrl,
  quickBooksOAuthCreds,
} from "@/lib/connectors/quickbooks/oauth";
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

  // Missing INTUIT_CLIENT_ID / INTUIT_CLIENT_SECRET on Vercel → clean "configure Intuit OAuth"
  // message, not a crash.
  const creds = quickBooksOAuthCreds();
  if (!creds) {
    return NextResponse.redirect(
      new URL(`${CONNECTIONS_PAGE}?quickbooks=not_configured`, request.url),
    );
  }

  const state = signState(
    JSON.stringify({
      userId: user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
      exp: Date.now() + 10 * 60 * 1000, // 10 minutes
    }),
  );

  return NextResponse.redirect(buildQuickBooksAuthorizeUrl(creds.clientId, state));
}
