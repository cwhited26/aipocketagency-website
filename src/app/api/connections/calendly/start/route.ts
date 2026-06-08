import { createClient } from "@/lib/supabase/server";
import { signState } from "@/lib/crypto/encrypt";
import {
  buildCalendlyAuthorizeUrl,
  calendlyOAuthCreds,
} from "@/lib/connectors/calendly/oauth";
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

  // Missing CALENDLY_CLIENT_ID / CALENDLY_CLIENT_SECRET on Vercel → clean "configure Calendly
  // OAuth" message, not a crash.
  const creds = calendlyOAuthCreds();
  if (!creds) {
    return NextResponse.redirect(
      new URL(`${CONNECTIONS_PAGE}?calendly=not_configured`, request.url),
    );
  }

  const state = signState(
    JSON.stringify({
      userId: user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
      exp: Date.now() + 10 * 60 * 1000, // 10 minutes
    }),
  );

  return NextResponse.redirect(buildCalendlyAuthorizeUrl(creds.clientId, state));
}
