import { createClient } from "@/lib/supabase/server";
import { verifyState, encrypt, DecryptionError } from "@/lib/crypto/encrypt";
import {
  exchangeCodeForToken,
  fetchGithubLogin,
  githubBuildConfig,
} from "@/lib/connectors/github-build/oauth";
import { upsertGithubBuildConnection } from "@/lib/pa-github-build-connections";
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

  // GitHub sends error= when the owner cancels the authorization.
  if (searchParams.has("error")) {
    return pageRedirect(request, "github_build=error");
  }

  const paramsParsed = SuccessParamsSchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!paramsParsed.success) {
    return pageRedirect(request, "github_build=error");
  }
  const { code, state: rawState } = paramsParsed.data;

  // Verify the signed state, then validate its shape + expiry.
  let statePayload: z.infer<typeof StatePayloadSchema>;
  try {
    const body = verifyState(rawState);
    const parsed = StatePayloadSchema.safeParse(JSON.parse(body));
    if (!parsed.success || Date.now() > parsed.data.exp) {
      return pageRedirect(request, "github_build=error");
    }
    statePayload = parsed.data;
  } catch (err) {
    if (err instanceof DecryptionError || err instanceof SyntaxError) {
      return pageRedirect(request, "github_build=error");
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
    return pageRedirect(request, "github_build=error");
  }

  // The OAuth App may have been deconfigured between start + callback — re-check before exchange.
  const config = githubBuildConfig();
  if (!config) {
    return pageRedirect(request, "github_build=not_configured");
  }

  const tokens = await exchangeCodeForToken(code, config);
  if (!tokens.ok) {
    return pageRedirect(request, "github_build=error");
  }

  const scopes = tokens.data.scope
    ? tokens.data.scope.split(/[\s,]+/).filter(Boolean)
    : ["repo", "workflow", "delete_repo"];
  const login = await fetchGithubLogin(tokens.data.access_token);

  const result = await upsertGithubBuildConnection({
    userId: user.id,
    login,
    // The OAuth access token is the most powerful secret PA holds — stored AES-256-GCM encrypted.
    accessTokenEncrypted: encrypt(tokens.data.access_token),
    scopes,
  });
  if (!result.ok) {
    return pageRedirect(request, "github_build=error");
  }

  return pageRedirect(request, "github_build=connected");
}
