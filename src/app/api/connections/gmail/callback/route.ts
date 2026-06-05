import { createClient } from "@/lib/supabase/server";
import { verifyState, encrypt, DecryptionError } from "@/lib/crypto/encrypt";
import { exchangeCodeForTokens, getProfile, gmailRedirectUri } from "@/lib/gmail";
import { upsertGmailConnection } from "@/lib/pa-gmail-connections";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNECTIONS_PAGE = "/app/settings/connections";

const SuccessParamsSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const StatePayloadSchema = z.object({
  userId: z.string().uuid(),
  nonce: z.string().min(16),
  exp: z.number().int().positive(),
});

function pageRedirect(request: NextRequest, param: string): NextResponse {
  return NextResponse.redirect(new URL(`${CONNECTIONS_PAGE}?${param}`, request.url));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;

  // Google sends error= when the user denies consent.
  if (searchParams.has("error")) {
    return pageRedirect(request, "connection=error");
  }

  const paramsParsed = SuccessParamsSchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!paramsParsed.success) {
    return pageRedirect(request, "connection=error");
  }
  const { code, state: rawState } = paramsParsed.data;

  // Verify the signed state, then validate its shape + expiry.
  let statePayload: z.infer<typeof StatePayloadSchema>;
  try {
    const body = verifyState(rawState);
    const parsed = StatePayloadSchema.safeParse(JSON.parse(body));
    if (!parsed.success || Date.now() > parsed.data.exp) {
      return pageRedirect(request, "connection=error");
    }
    statePayload = parsed.data;
  } catch (err) {
    if (err instanceof DecryptionError || err instanceof SyntaxError) {
      return pageRedirect(request, "connection=error");
    }
    throw err;
  }

  // CSRF: the session user must match the user who started the flow.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/app/login?next=${encodeURIComponent(CONNECTIONS_PAGE)}`, request.url),
    );
  }
  if (user.id !== statePayload.userId) {
    return pageRedirect(request, "connection=error");
  }

  // Exchange the code for tokens. redirect_uri must be a bit-exact match with the
  // one sent on the auth request — both come from gmailRedirectUri(), not the host.
  const tokens = await exchangeCodeForTokens(code, gmailRedirectUri());
  if (!tokens.ok) {
    return pageRedirect(
      request,
      tokens.error === "oauth_not_configured" ? "connection=not_configured" : "connection=error",
    );
  }

  // A connect flow with prompt=consent must yield a refresh token — without it we
  // cannot sync. Fail loudly rather than store a connection that can never refresh.
  if (!tokens.data.refresh_token) {
    return pageRedirect(request, "connection=error");
  }

  // Pull the account email (cosmetic, but useful) from the profile.
  const profile = await getProfile(tokens.data.access_token);
  const email = profile.ok ? profile.data.emailAddress ?? null : null;

  const scopes = tokens.data.scope ? tokens.data.scope.split(/\s+/).filter(Boolean) : [];
  const accessTokenExpiresAt = new Date(
    Date.now() + tokens.data.expires_in * 1000,
  ).toISOString();

  const result = await upsertGmailConnection({
    userId: user.id,
    email,
    refreshTokenEncrypted: encrypt(tokens.data.refresh_token),
    accessToken: tokens.data.access_token,
    accessTokenExpiresAt,
    scopes,
  });
  if (!result.ok) {
    return pageRedirect(request, "connection=error");
  }

  return pageRedirect(request, "connection=connected");
}
