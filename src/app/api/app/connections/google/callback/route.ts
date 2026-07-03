import { createClient } from "@/lib/supabase/server";
import { verifyOAuthState, vaultEncrypt, VaultDecryptError } from "@/lib/pa-vault";
import { upsertConnection } from "@/lib/pa-connections";
import { markOnboardingStepComplete } from "@/lib/onboarding/progress";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SuccessParamsSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expires_in: z.number().int().positive(),
  scope: z.string(),
});

const UserinfoSchema = z.object({
  email: z.string().email().optional(),
});

function settingsRedirect(request: NextRequest, param: string): NextResponse {
  return NextResponse.redirect(new URL(`/app/settings?${param}`, request.url));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;

  // Google sends error= when the user denies consent
  if (searchParams.has("error")) {
    return settingsRedirect(request, "connection=error");
  }

  const rawParams = Object.fromEntries(searchParams.entries());
  const paramsParsed = SuccessParamsSchema.safeParse(rawParams);
  if (!paramsParsed.success) {
    return settingsRedirect(request, "connection=error");
  }
  const { code, state: rawState } = paramsParsed.data;

  // Verify state signature and extract payload
  let statePayload;
  try {
    statePayload = verifyOAuthState(rawState);
  } catch (err) {
    if (err instanceof VaultDecryptError) {
      return settingsRedirect(request, "connection=error");
    }
    throw err;
  }

  // CSRF: session user must match state userId
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/app/login?next=/app/settings", request.url));
  }
  if (user.id !== statePayload.userId) {
    return settingsRedirect(request, "connection=error");
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return settingsRedirect(request, "connection=not_configured");
  }

  // Exchange code for tokens (direct fetch — no googleapis SDK)
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: statePayload.callbackUrl,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenRes.ok) {
    return settingsRedirect(request, "connection=error");
  }

  let tokenData: z.infer<typeof TokenResponseSchema>;
  try {
    const raw = await tokenRes.json();
    const parsed = TokenResponseSchema.safeParse(raw);
    if (!parsed.success) return settingsRedirect(request, "connection=error");
    tokenData = parsed.data;
  } catch {
    return settingsRedirect(request, "connection=error");
  }

  // Fetch account email from Google userinfo
  const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  let accountEmail: string | null = null;
  if (userinfoRes.ok) {
    try {
      const raw = await userinfoRes.json();
      const parsed = UserinfoSchema.safeParse(raw);
      if (parsed.success && parsed.data.email) {
        accountEmail = parsed.data.email;
      }
    } catch {
      // Non-fatal: email display is cosmetic
    }
  }

  // Encrypt tokens before storage
  const encryptedAccessToken = vaultEncrypt(tokenData.access_token);
  const encryptedRefreshToken = tokenData.refresh_token
    ? vaultEncrypt(tokenData.refresh_token)
    : null;

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  const scopes = tokenData.scope.split(/\s+/).filter(Boolean);

  const result = await upsertConnection({
    userId: user.id,
    provider: statePayload.provider,
    encryptedAccessToken,
    encryptedRefreshToken,
    scopes,
    accountEmail,
    expiresAt,
  });

  if (!result.ok) {
    return settingsRedirect(request, "connection=error");
  }

  // PA-POS-36: the first Connection completes the "Connect your first tool" step. Never throws.
  await markOnboardingStepComplete(user.id, "connect_tool");

  return settingsRedirect(request, `connection=connected&provider=${statePayload.provider}`);
}
