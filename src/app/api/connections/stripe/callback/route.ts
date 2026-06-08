import { createClient } from "@/lib/supabase/server";
import { verifyState, encrypt, DecryptionError } from "@/lib/crypto/encrypt";
import {
  exchangeCodeForTokens,
  fetchAccountDisplayName,
  stripeConnectConfig,
} from "@/lib/connectors/stripe/oauth";
import { upsertStripeConnection } from "@/lib/pa-stripe-connections";
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

  // Stripe sends error= when the owner cancels the Connect flow.
  if (searchParams.has("error")) {
    return pageRedirect(request, "stripe=error");
  }

  const paramsParsed = SuccessParamsSchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!paramsParsed.success) {
    return pageRedirect(request, "stripe=error");
  }
  const { code, state: rawState } = paramsParsed.data;

  // Verify the signed state, then validate its shape + expiry.
  let statePayload: z.infer<typeof StatePayloadSchema>;
  try {
    const body = verifyState(rawState);
    const parsed = StatePayloadSchema.safeParse(JSON.parse(body));
    if (!parsed.success || Date.now() > parsed.data.exp) {
      return pageRedirect(request, "stripe=error");
    }
    statePayload = parsed.data;
  } catch (err) {
    if (err instanceof DecryptionError || err instanceof SyntaxError) {
      return pageRedirect(request, "stripe=error");
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
    return pageRedirect(request, "stripe=error");
  }

  // Connect may have been disabled between start + callback — re-check before the exchange.
  const config = stripeConnectConfig();
  if (!config) {
    return pageRedirect(request, "stripe=not_configured");
  }

  // Exchange the code for the connected account id + tokens (client_secret = platform key).
  const tokens = await exchangeCodeForTokens(code, config);
  if (!tokens.ok) {
    return pageRedirect(request, "stripe=error");
  }

  const scopes = tokens.data.scope ? tokens.data.scope.split(/\s+/).filter(Boolean) : ["read_write"];
  const businessName = await fetchAccountDisplayName(config.clientSecret, tokens.data.stripe_user_id);

  const result = await upsertStripeConnection({
    userId: user.id,
    businessName,
    stripeAccountId: tokens.data.stripe_user_id,
    // Stripe returns a refresh token on a successful Connect grant; store it encrypted.
    refreshTokenEncrypted: tokens.data.refresh_token ? encrypt(tokens.data.refresh_token) : null,
    scopes,
  });
  if (!result.ok) {
    return pageRedirect(request, "stripe=error");
  }

  return pageRedirect(request, "stripe=connected");
}
