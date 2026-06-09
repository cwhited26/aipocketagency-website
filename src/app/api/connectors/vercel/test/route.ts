// POST /api/connectors/vercel/test
// Probe the owner's stored Vercel connection: resolve + decrypt the token and call GET /v2/user. A
// dead/revoked token flips the connection to `error` (the executor's markVercelConnectionError path
// covers the action lane; here a failing probe just reports it). Returns the resolved account label
// so the Connections card can confirm the token still works. No approval — a read-only credential check.

import { createClient } from "@/lib/supabase/server";
import { resolveVercelToken, markVercelConnectionError } from "@/lib/pa-vercel-connections";
import { verifyVercelToken } from "@/lib/connectors/vercel/actions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolved = await resolveVercelToken(user.id);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const check = await verifyVercelToken(resolved.token, resolved.teamId);
  if (!check.ok) {
    // The token no longer authenticates — surface a reconnect.
    if (check.status === 401) await markVercelConnectionError(user.id);
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  return NextResponse.json({
    ok: true,
    account: check.identity.username ?? check.identity.email,
  });
}
