import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safePath(raw: unknown): string {
  if (typeof raw !== "string" || raw === "") return "/app/onboarding";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app/onboarding";
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: { email?: unknown; next?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; next?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 422 });
  }

  const next = safePath(body.next);
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aipocketagent.com";

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteOrigin}/app/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
