import { createClient } from "@/lib/supabase/server";
import { signState } from "@/lib/crypto/encrypt";
import { stripeConnectConfig, buildStripeAuthorizeUrl } from "@/lib/connectors/stripe/oauth";
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

  // Connect is driven by the platform secret key (reused) + the platform's Connect application id
  // (STRIPE_CONNECT_CLIENT_ID, which only exists once Connect is enabled in the Stripe Dashboard).
  // Its absence is the "Connect not enabled" state → a clean message, never a crash.
  const config = stripeConnectConfig();
  if (!config) {
    return NextResponse.redirect(
      new URL(`${CONNECTIONS_PAGE}?stripe=not_configured`, request.url),
    );
  }

  const state = signState(
    JSON.stringify({
      userId: user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
      exp: Date.now() + 10 * 60 * 1000, // 10 minutes
    }),
  );

  return NextResponse.redirect(buildStripeAuthorizeUrl(config.clientId, state));
}
