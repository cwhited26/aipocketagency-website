import { createClient } from "@/lib/supabase/server";
import { verifyState, encrypt, DecryptionError } from "@/lib/crypto/encrypt";
import { exchangeCodeForTokens, slackRedirectUri } from "@/lib/slack";
import { upsertSlackConnection } from "@/lib/pa-slack-connections";
import { markOnboardingStepComplete } from "@/lib/onboarding/progress";
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

  // Slack sends error= when the user denies the install.
  if (searchParams.has("error")) {
    return pageRedirect(request, "slack=error");
  }

  const paramsParsed = SuccessParamsSchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!paramsParsed.success) {
    return pageRedirect(request, "slack=error");
  }
  const { code, state: rawState } = paramsParsed.data;

  // Verify the signed state, then validate its shape + expiry.
  let statePayload: z.infer<typeof StatePayloadSchema>;
  try {
    const body = verifyState(rawState);
    const parsed = StatePayloadSchema.safeParse(JSON.parse(body));
    if (!parsed.success || Date.now() > parsed.data.exp) {
      return pageRedirect(request, "slack=error");
    }
    statePayload = parsed.data;
  } catch (err) {
    if (err instanceof DecryptionError || err instanceof SyntaxError) {
      return pageRedirect(request, "slack=error");
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
    return pageRedirect(request, "slack=error");
  }

  // Exchange the code. redirect_uri must be a bit-exact match with the authorize request —
  // both come from slackRedirectUri(), never the host.
  const tokens = await exchangeCodeForTokens(code, slackRedirectUri());
  if (!tokens.ok) {
    return pageRedirect(
      request,
      tokens.error === "oauth_not_configured" ? "slack=not_configured" : "slack=error",
    );
  }

  const data = tokens.data;
  const scopes = data.scope ? data.scope.split(/[,\s]+/).filter(Boolean) : [];
  const workspace = data.team?.name ?? null;

  // Token rotation install → store the refresh token + cache the access token & expiry.
  // Long-lived bot install → store the bot token as the durable secret, no cached access token.
  const rotating = Boolean(data.refresh_token && data.expires_in);
  const refreshTokenEncrypted = encrypt(rotating ? (data.refresh_token as string) : data.access_token);
  const accessToken = rotating ? data.access_token : null;
  const accessTokenExpiresAt =
    rotating && data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

  const result = await upsertSlackConnection({
    userId: user.id,
    workspace,
    refreshTokenEncrypted,
    accessToken,
    accessTokenExpiresAt,
    scopes,
    // Persist the Slack identity so an inbound DM / @mention resolves back to this owner.
    slackUserId: data.authed_user?.id ?? null,
    slackTeamId: data.team?.id ?? null,
  });
  if (!result.ok) {
    return pageRedirect(request, "slack=error");
  }

  // PA-POS-36: the first Connection completes the "Connect your first tool" step. Never throws.
  await markOnboardingStepComplete(user.id, "connect_tool");

  return pageRedirect(request, "slack=connected");
}
