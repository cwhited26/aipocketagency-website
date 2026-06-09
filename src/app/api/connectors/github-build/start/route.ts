import { createClient } from "@/lib/supabase/server";
import { signState } from "@/lib/crypto/encrypt";
import {
  githubBuildConfig,
  buildGithubBuildAuthorizeUrl,
} from "@/lib/connectors/github-build/oauth";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONNECTIONS_PAGE = "/app/settings/connections";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/app/login?next=${encodeURIComponent(CONNECTIONS_PAGE)}`, request.url),
    );
  }

  // The OAuth App client id/secret only exist once Chase registers the GitHub Build OAuth App.
  // Their absence is the "not enabled yet" state → a clean message, never a crash.
  const config = githubBuildConfig();
  if (!config) {
    return NextResponse.redirect(
      new URL(`${CONNECTIONS_PAGE}?github_build=not_configured`, request.url),
    );
  }

  const state = signState(
    JSON.stringify({
      userId: user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
      exp: Date.now() + 10 * 60 * 1000, // 10 minutes
    }),
  );

  return NextResponse.redirect(buildGithubBuildAuthorizeUrl(config.clientId, state));
}
