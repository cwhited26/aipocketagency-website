import { createClient } from "@/lib/supabase/server";
import { verifyState, encrypt, DecryptionError } from "@/lib/crypto/encrypt";
import {
  exchangeCodeForTokens,
  fetchCurrentUser,
  calendlyRedirectUri,
  CALENDLY_SCOPES,
} from "@/lib/connectors/calendly/oauth";
import { upsertCalendlyConnection } from "@/lib/pa-calendly-connections";
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

  // Calendly sends error= when the user denies the connection.
  if (searchParams.has("error")) {
    return pageRedirect(request, "calendly=error");
  }

  const paramsParsed = SuccessParamsSchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!paramsParsed.success) {
    return pageRedirect(request, "calendly=error");
  }
  const { code, state: rawState } = paramsParsed.data;

  // Verify the signed state, then validate its shape + expiry.
  let statePayload: z.infer<typeof StatePayloadSchema>;
  try {
    const body = verifyState(rawState);
    const parsed = StatePayloadSchema.safeParse(JSON.parse(body));
    if (!parsed.success || Date.now() > parsed.data.exp) {
      return pageRedirect(request, "calendly=error");
    }
    statePayload = parsed.data;
  } catch (err) {
    if (err instanceof DecryptionError || err instanceof SyntaxError) {
      return pageRedirect(request, "calendly=error");
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
    return pageRedirect(request, "calendly=error");
  }

  // Exchange the code. redirect_uri must be a bit-exact match with the authorize request —
  // both come from calendlyRedirectUri(), never the host.
  const tokens = await exchangeCodeForTokens(code, calendlyRedirectUri());
  if (!tokens.ok) {
    return pageRedirect(
      request,
      tokens.error === "oauth_not_configured" ? "calendly=not_configured" : "calendly=error",
    );
  }

  // The authorization-code exchange must yield a refresh token; without it we can never refresh,
  // so fail loudly rather than store a connection that can't recover.
  if (!tokens.data.refreshToken) {
    return pageRedirect(request, "calendly=error");
  }

  // Resolve the connected user's resource URI (every Calendly call is scoped to it). The token's
  // `owner` field carries it; /users/me is the fallback + the source of the display email/name.
  const me = await fetchCurrentUser(tokens.data.accessToken);
  const userUri = tokens.data.ownerUri ?? (me.ok ? me.data.uri : null);
  if (!userUri) {
    return pageRedirect(request, "calendly=error");
  }
  const email = me.ok ? me.data.email ?? me.data.name : null;

  const accessTokenExpiresAt = new Date(
    Date.now() + tokens.data.expiresIn * 1000,
  ).toISOString();

  const result = await upsertCalendlyConnection({
    userId: user.id,
    email,
    userUri,
    refreshTokenEncrypted: encrypt(tokens.data.refreshToken),
    accessToken: tokens.data.accessToken,
    accessTokenExpiresAt,
    scopes: [...CALENDLY_SCOPES],
  });
  if (!result.ok) {
    return pageRedirect(request, "calendly=error");
  }

  return pageRedirect(request, "calendly=connected");
}
