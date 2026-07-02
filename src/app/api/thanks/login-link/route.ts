// /api/thanks/login-link — resend a login magic link from the /thanks page. The webhook already sent
// one when it created the pay-first account; this backs the "resend" button for a buyer whose email
// bounced or who missed it. Rate-limiting and user existence are handled by Supabase Auth.

import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPocketAgentLoginLink } from "@/lib/pocket-agent-login-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.string().email(),
  ),
});

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid email required" }, { status: 422 });
  }

  const sent = await sendPocketAgentLoginLink(parsed.data.email);
  if (!sent.ok) {
    return NextResponse.json(
      { error: "Could not send the link. Try again in a minute." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
