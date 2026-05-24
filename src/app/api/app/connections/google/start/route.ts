import { createClient } from "@/lib/supabase/server";
import { signOAuthState } from "@/lib/pa-vault";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES: Record<"google_gmail" | "google_calendar", string[]> = {
  google_gmail: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
  google_calendar: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.readonly",
  ],
};

const StartParamsSchema = z.object({
  provider: z.enum(["google_gmail", "google_calendar"]),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/app/login?next=/app/settings", request.url));
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = StartParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.redirect(
      new URL("/app/settings?connection=error", request.url),
    );
  }
  const { provider } = parsed.data;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/app/settings?connection=not_configured", request.url),
    );
  }

  const origin = new URL(request.url).origin;
  const callbackUrl = `${origin}/api/app/connections/google/callback`;

  const state = signOAuthState({
    userId: user.id,
    provider,
    callbackUrl,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES[provider].join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
