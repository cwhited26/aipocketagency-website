// GET /api/connectors/github-build/callback/workshop — the workshop attendee's GitHub OAuth
// callback (PA-POS-38 §24.4). A SUBPATH of the registered GitHub Build callback so the shipped
// OAuth App covers it (GitHub permits subdirectory redirect_uris). State is the AES-256-GCM
// envelope of the registration id; on success the token lands encrypted on the attendance row
// and the attendee bounces back into the live player.

import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto/encrypt";
import { githubBuildConfig } from "@/lib/connectors/github-build/oauth";
import {
  decodeWorkshopOauthState,
  exchangeWorkshopGithubCode,
  fetchWorkshopGithubLogin,
} from "@/lib/workshop/github";
import { getWorkshopRegistration, upsertWorkshopAttendance } from "@/lib/workshop/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function playerUrl(origin: string, registrationId: string, flag: string): string {
  return `${origin}/workshop/live/${registrationId}?github=${flag}`;
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const origin = (process.env.PA_OAUTH_REDIRECT_BASE ?? "https://aipocketagent.com").replace(/\/+$/, "");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/workshop`);
  }

  const registrationId = decodeWorkshopOauthState(state);
  if (!registrationId) {
    console.error("[workshop/github-callback] state decode failed", {});
    return NextResponse.redirect(`${origin}/workshop`);
  }

  const reg = await getWorkshopRegistration(registrationId);
  if (!reg.ok || !reg.data) {
    console.error("[workshop/github-callback] unknown registration", {
      registration_id: registrationId,
    });
    return NextResponse.redirect(`${origin}/workshop`);
  }

  const config = githubBuildConfig();
  if (!config) {
    console.error("[workshop/github-callback] OAuth App not configured", {
      registration_id: registrationId,
    });
    return NextResponse.redirect(playerUrl(origin, registrationId, "error"));
  }

  const token = await exchangeWorkshopGithubCode(code, config);
  if (!token.ok) {
    console.error("[workshop/github-callback] code exchange failed", {
      registration_id: registrationId,
      status: token.status,
      error: token.error,
    });
    return NextResponse.redirect(playerUrl(origin, registrationId, "error"));
  }

  const login = await fetchWorkshopGithubLogin(token.data);
  const saved = await upsertWorkshopAttendance(registrationId, {
    github_token_encrypted: encrypt(token.data),
    github_login: login.ok ? login.data : null,
    last_active_at: new Date().toISOString(),
  });
  if (!saved.ok) {
    console.error("[workshop/github-callback] token save failed", {
      registration_id: registrationId,
      status: saved.status,
      error: saved.error,
    });
    return NextResponse.redirect(playerUrl(origin, registrationId, "error"));
  }

  return NextResponse.redirect(playerUrl(origin, registrationId, "connected"));
}
