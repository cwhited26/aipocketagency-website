// GET /api/channels/slack/callback — the Channels Gateway Slack OAuth callback (PA-CHAN-1).
//
// Verify the signed CSRF state, confirm the session user matches who started the install, exchange
// the code for a bot token, and upsert a pa_channel_connections row keyed on (slack, team:user).
// The bot token is the durable secret the adapter sends with (Phase 1 = long-lived install, no
// rotation). On success, bounce back to the owner page so they can pick the answering Persona.

import { createClient } from "@/lib/supabase/server";
import { verifyState, DecryptionError } from "@/lib/crypto/encrypt";
import { exchangeChannelSlackCode } from "@/lib/channels/adapters/slack/oauth";
import { upsertChannelConnection } from "@/lib/channels/store";
import { channelLog } from "@/lib/channels/log";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHANNELS_PAGE = "/app/connections/slack";

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
  return NextResponse.redirect(new URL(`${CHANNELS_PAGE}?${param}`, request.url));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;

  // Slack sends error= when the owner denies the install.
  if (searchParams.has("error")) return pageRedirect(request, "slack=error");

  const paramsParsed = SuccessParamsSchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!paramsParsed.success) return pageRedirect(request, "slack=error");
  const { code, state: rawState } = paramsParsed.data;

  // Verify the signed state, then validate its shape + expiry.
  let statePayload: z.infer<typeof StatePayloadSchema>;
  try {
    const body = verifyState(rawState);
    const parsed = StatePayloadSchema.safeParse(JSON.parse(body));
    if (!parsed.success || Date.now() > parsed.data.exp) return pageRedirect(request, "slack=error");
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
      new URL(`/app/login?next=${encodeURIComponent(CHANNELS_PAGE)}`, request.url),
    );
  }
  if (user.id !== statePayload.userId) return pageRedirect(request, "slack=error");

  // Exchange the code. redirect_uri must be bit-exact with the authorize request — both come from
  // channelSlackRedirectUri(), never the request host.
  const tokens = await exchangeChannelSlackCode(code);
  if (!tokens.ok) {
    return pageRedirect(
      request,
      tokens.error === "oauth_not_configured" ? "slack=not_configured" : "slack=error",
    );
  }

  const data = tokens.data;
  const teamId = data.team?.id ?? "";
  const slackUserId = data.authed_user?.id ?? "";
  if (!teamId || !slackUserId) {
    channelLog.error("slack install missing team/user id", {});
    return pageRedirect(request, "slack=error");
  }

  const result = await upsertChannelConnection({
    ownerId: user.id,
    channelSlug: "slack",
    // The resolve key the inbound webhook looks an owner up by.
    externalId: `${teamId}:${slackUserId}`,
    authToken: data.access_token,
    config: {
      workspace: data.team?.name ?? null,
      scopes: data.scope ? data.scope.split(/[,\s]+/).filter(Boolean) : [],
      botUserId: data.bot_user_id ?? null,
      teamId,
      slackUserId,
    },
  });
  if (!result.ok) {
    channelLog.error("slack channel connection upsert failed", { status: result.status });
    return pageRedirect(request, "slack=error");
  }

  return pageRedirect(request, "slack=connected");
}
