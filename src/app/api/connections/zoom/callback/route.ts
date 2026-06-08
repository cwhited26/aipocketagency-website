import { createClient } from "@/lib/supabase/server";
import { verifyState, encrypt, DecryptionError } from "@/lib/crypto/encrypt";
import {
  exchangeCodeForTokens,
  fetchZoomUser,
  zoomOAuthConfig,
  ZOOM_SCOPES,
} from "@/lib/connectors/zoom/oauth";
import { upsertZoomConnection } from "@/lib/pa-zoom-connections";
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

  // Zoom sends error= when the owner denies consent.
  if (searchParams.has("error")) {
    return pageRedirect(request, "zoom=error");
  }

  const paramsParsed = SuccessParamsSchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!paramsParsed.success) {
    return pageRedirect(request, "zoom=error");
  }
  const { code, state: rawState } = paramsParsed.data;

  // Verify the signed state, then validate its shape + expiry.
  let statePayload: z.infer<typeof StatePayloadSchema>;
  try {
    const body = verifyState(rawState);
    const parsed = StatePayloadSchema.safeParse(JSON.parse(body));
    if (!parsed.success || Date.now() > parsed.data.exp) {
      return pageRedirect(request, "zoom=error");
    }
    statePayload = parsed.data;
  } catch (err) {
    if (err instanceof DecryptionError || err instanceof SyntaxError) {
      return pageRedirect(request, "zoom=error");
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
    return pageRedirect(request, "zoom=error");
  }

  // Zoom may have been deconfigured between start + callback — re-check before the exchange.
  const config = zoomOAuthConfig();
  if (!config) {
    return pageRedirect(request, "zoom=not_configured");
  }

  // Exchange the code for tokens (Basic auth = base64(client_id:client_secret)).
  const tokens = await exchangeCodeForTokens(code, config);
  if (!tokens.ok) {
    return pageRedirect(request, "zoom=error");
  }

  // A successful authorization-code grant must yield a refresh token — without it we can never
  // refresh. Fail loudly rather than store a connection that can't recover.
  if (!tokens.data.refresh_token) {
    return pageRedirect(request, "zoom=error");
  }

  // Resolve the owner's Zoom user id (needed on every /users/{userId}/meetings call) + email.
  const me = await fetchZoomUser(tokens.data.access_token);
  if (!me.ok) {
    return pageRedirect(request, "zoom=error");
  }

  const scopes = tokens.data.scope
    ? tokens.data.scope.split(/\s+/).filter(Boolean)
    : [...ZOOM_SCOPES];
  const accessTokenExpiresAt = new Date(Date.now() + tokens.data.expires_in * 1000).toISOString();

  const result = await upsertZoomConnection({
    userId: user.id,
    email: me.data.email ?? null,
    zoomUserId: me.data.id,
    refreshTokenEncrypted: encrypt(tokens.data.refresh_token),
    accessToken: tokens.data.access_token,
    accessTokenExpiresAt,
    scopes,
  });
  if (!result.ok) {
    return pageRedirect(request, "zoom=error");
  }

  return pageRedirect(request, "zoom=connected");
}
