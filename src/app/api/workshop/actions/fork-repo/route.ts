// POST /api/workshop/actions/fork-repo — the min-15 "build with me" button (PA-POS-38 §24.4).
// First click without a GitHub grant returns the authorize URL (the player opens it; the callback
// stores the token on the attendance row and bounces back). With a token: POST /generate on the
// template repo, store the fork, return the repo URL so the button flips to "✓ Forked".

import { NextResponse } from "next/server";
import { z } from "zod";
import { decrypt } from "@/lib/crypto/encrypt";
import {
  getWorkshopAttendance,
  getWorkshopRegistration,
  upsertWorkshopAttendance,
} from "@/lib/workshop/db";
import {
  fetchWorkshopGithubLogin,
  generateBusinessBrainRepo,
  isWorkshopGithubConfigured,
  workshopGithubAuthorizeUrl,
} from "@/lib/workshop/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  registration_id: z.string().uuid(),
});

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }
  const registrationId = parsed.data.registration_id;

  const reg = await getWorkshopRegistration(registrationId);
  if (!reg.ok || !reg.data) {
    return NextResponse.json({ error: "unknown registration" }, { status: 404 });
  }

  const attendance = await getWorkshopAttendance(registrationId);
  if (!attendance.ok) {
    console.error("[workshop/fork-repo] attendance lookup failed", {
      registration_id: registrationId,
      status: attendance.status,
      error: attendance.error,
    });
    return NextResponse.json({ error: "lookup failed" }, { status: 502 });
  }

  // Already forked — the button re-click path.
  if (attendance.data?.forked_repo_url) {
    return NextResponse.json({
      forked: true,
      repo_url: attendance.data.forked_repo_url,
      repo_full_name: attendance.data.forked_repo_full_name,
      github_login: attendance.data.github_login,
    });
  }

  if (!attendance.data?.github_token_encrypted) {
    if (!isWorkshopGithubConfigured()) {
      console.error("[workshop/fork-repo] GitHub OAuth App not configured", {
        registration_id: registrationId,
      });
      return NextResponse.json({ error: "GitHub connection not available" }, { status: 503 });
    }
    return NextResponse.json({ needs_auth: true, authorize_url: workshopGithubAuthorizeUrl(registrationId) });
  }

  let token: string;
  try {
    token = decrypt(attendance.data.github_token_encrypted);
  } catch (err) {
    console.error("[workshop/fork-repo] token decrypt failed — forcing re-auth", {
      registration_id: registrationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ needs_auth: true, authorize_url: workshopGithubAuthorizeUrl(registrationId) });
  }

  let login = attendance.data.github_login;
  if (!login) {
    const fetched = await fetchWorkshopGithubLogin(token);
    if (!fetched.ok) {
      console.error("[workshop/fork-repo] login fetch failed — forcing re-auth", {
        registration_id: registrationId,
        status: fetched.status,
      });
      return NextResponse.json({ needs_auth: true, authorize_url: workshopGithubAuthorizeUrl(registrationId) });
    }
    login = fetched.data;
  }

  const repo = await generateBusinessBrainRepo(token, login);
  if (!repo.ok) {
    console.error("[workshop/fork-repo] template generate failed", {
      registration_id: registrationId,
      status: repo.status,
      error: repo.error,
    });
    return NextResponse.json({ error: "fork failed — try the button again" }, { status: 502 });
  }

  const saved = await upsertWorkshopAttendance(registrationId, {
    forked_repo_url: repo.data.html_url,
    forked_repo_full_name: repo.data.full_name,
    github_login: login,
    last_active_at: new Date().toISOString(),
  });
  if (!saved.ok) {
    console.error("[workshop/fork-repo] attendance save failed", {
      registration_id: registrationId,
      status: saved.status,
      error: saved.error,
    });
  }

  return NextResponse.json({
    forked: true,
    repo_url: repo.data.html_url,
    repo_full_name: repo.data.full_name,
    github_login: login,
  });
}
