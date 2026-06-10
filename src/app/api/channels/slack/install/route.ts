// GET /api/channels/slack/install — start the Channels Gateway Slack install (OAuth v2 start).
//
// Distinct from the legacy Slack Connection's /api/connections/slack/start: this is the gateway's
// own install surface. Auth the owner, sign a CSRF state (their user id + a nonce + a 10-minute
// expiry), and redirect to Slack's authorize URL with the channel scopes (SPEC §8.2).

import { createClient } from "@/lib/supabase/server";
import { signState } from "@/lib/crypto/encrypt";
import { slackOAuthCreds } from "@/lib/slack";
import { buildChannelSlackAuthorizeUrl } from "@/lib/channels/adapters/slack/oauth";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHANNELS_PAGE = "/app/connections/slack";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/app/login?next=${encodeURIComponent(CHANNELS_PAGE)}`, request.url),
    );
  }

  // Missing client id/secret on Vercel → a clean "configure Slack OAuth" message, not a crash.
  const creds = slackOAuthCreds();
  if (!creds) {
    return NextResponse.redirect(new URL(`${CHANNELS_PAGE}?slack=not_configured`, request.url));
  }

  const state = signState(
    JSON.stringify({
      userId: user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
      exp: Date.now() + 10 * 60 * 1000, // 10 minutes
    }),
  );

  return NextResponse.redirect(buildChannelSlackAuthorizeUrl(creds.clientId, state));
}
