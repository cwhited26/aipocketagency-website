import { createClient } from "@/lib/supabase/server";
import { verifyState, encrypt, DecryptionError } from "@/lib/crypto/encrypt";
import {
  exchangeCodeForTokens,
  fetchCompanyName,
  hasAccountingScope,
  quickBooksRedirectUri,
  QUICKBOOKS_SCOPES,
} from "@/lib/connectors/quickbooks/oauth";
import { upsertQuickBooksConnection } from "@/lib/pa-quickbooks-connections";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNECTIONS_PAGE = "/app/settings/connections";

// Intuit returns the company id as `realmId` alongside code + state.
const SuccessParamsSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  realmId: z.string().min(1),
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

  // Intuit sends error= when the user denies the connection.
  if (searchParams.has("error")) {
    return pageRedirect(request, "quickbooks=error");
  }

  const paramsParsed = SuccessParamsSchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!paramsParsed.success) {
    return pageRedirect(request, "quickbooks=error");
  }
  const { code, state: rawState, realmId } = paramsParsed.data;

  // Verify the signed state, then validate its shape + expiry.
  let statePayload: z.infer<typeof StatePayloadSchema>;
  try {
    const body = verifyState(rawState);
    const parsed = StatePayloadSchema.safeParse(JSON.parse(body));
    if (!parsed.success || Date.now() > parsed.data.exp) {
      return pageRedirect(request, "quickbooks=error");
    }
    statePayload = parsed.data;
  } catch (err) {
    if (err instanceof DecryptionError || err instanceof SyntaxError) {
      return pageRedirect(request, "quickbooks=error");
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
    return pageRedirect(request, "quickbooks=error");
  }

  // Exchange the code. redirect_uri must be a bit-exact match with the authorize request —
  // both come from quickBooksRedirectUri(), never the host.
  const tokens = await exchangeCodeForTokens(code, quickBooksRedirectUri());
  if (!tokens.ok) {
    return pageRedirect(
      request,
      tokens.error === "oauth_not_configured" ? "quickbooks=not_configured" : "quickbooks=error",
    );
  }

  // Intuit's authorization-code exchange always returns a refresh token; without it we could
  // never refresh, so fail loudly rather than store a connection that can't recover.
  if (!tokens.data.refreshToken) {
    return pageRedirect(request, "quickbooks=error");
  }

  // The single accounting scope is implicit in the grant (Intuit doesn't echo scope on the
  // token response), so record the requested scope set.
  const scopes = [...QUICKBOOKS_SCOPES];
  if (!hasAccountingScope(scopes)) {
    return pageRedirect(request, "quickbooks=missing_scope");
  }

  const companyName = await fetchCompanyName(tokens.data.accessToken, realmId);
  const accessTokenExpiresAt = new Date(
    Date.now() + tokens.data.expiresIn * 1000,
  ).toISOString();

  const result = await upsertQuickBooksConnection({
    userId: user.id,
    companyName,
    realmId,
    refreshTokenEncrypted: encrypt(tokens.data.refreshToken),
    accessToken: tokens.data.accessToken,
    accessTokenExpiresAt,
    scopes,
  });
  if (!result.ok) {
    return pageRedirect(request, "quickbooks=error");
  }

  return pageRedirect(request, "quickbooks=connected");
}
