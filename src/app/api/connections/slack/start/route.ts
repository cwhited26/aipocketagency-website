import { createClient } from "@/lib/supabase/server";
import { signState } from "@/lib/crypto/encrypt";
import { slackOAuthCreds } from "@/lib/slack";
import { buildSlackAuthorizeUrl } from "@/lib/connectors/slack/oauth";
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

  // Missing client id/secret on Vercel → clean "configure Slack OAuth" message, not a crash.
  const creds = slackOAuthCreds();
  if (!creds) {
    return NextResponse.redirect(
      new URL(`${CONNECTIONS_PAGE}?slack=not_configured`, request.url),
    );
  }

  const state = signState(
    JSON.stringify({
      userId: user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
      exp: Date.now() + 10 * 60 * 1000, // 10 minutes
    }),
  );

  return NextResponse.redirect(buildSlackAuthorizeUrl(creds.clientId, state));
}
