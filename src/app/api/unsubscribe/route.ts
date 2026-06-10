// POST /api/unsubscribe — flip the marketing-email opt-out flag for an email. Re-verifies the HMAC
// token server-side (never trusts the client), sets pa_email_preferences.unsubscribed_at, and cancels
// any pending marketing emails for that address. No auth — the token IS the authorization, and the
// email may belong to a not-yet-registered Pilot visitor.

import { NextResponse, type NextRequest } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/emails/render";
import { cancelPendingForEmail, setUnsubscribed } from "@/lib/emails/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { email?: unknown; token?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; token?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email : "";
  const token = typeof body.token === "string" ? body.token : "";
  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 403 });
  }

  const set = await setUnsubscribed(email);
  if (!set.ok) {
    console.error("[unsubscribe] failed to set preference", {
      status: set.status,
      error: set.error,
    });
    return NextResponse.json({ error: "could not unsubscribe" }, { status: 500 });
  }

  // Cancel any pending marketing rows for this email so the cron doesn't send them before next sweep.
  const cancelled = await cancelPendingForEmail(email.trim().toLowerCase(), "unsubscribed");
  if (!cancelled.ok) {
    console.error("[unsubscribe] failed to cancel pending emails", {
      status: cancelled.status,
      error: cancelled.error,
    });
  }

  return NextResponse.json({ ok: true });
}
