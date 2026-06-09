// POST /api/connectors/vercel/connect  { token, teamId? }
// Save the owner's pasted Vercel API token. The token is validated against Vercel (GET /v2/user)
// before it's stored — we never persist a dead token — and the resolved username/email becomes the
// Connections-card label. Stored AES-256-GCM encrypted in pa_connections.config (see
// pa-vercel-connections.ts). Vercel has no user-facing OAuth, so this paste flow is the connect path.

import { createClient } from "@/lib/supabase/server";
import { storeVercelConnection } from "@/lib/pa-vercel-connections";
import { verifyVercelToken } from "@/lib/connectors/vercel/actions";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1).max(500),
  // Optional team id (team-scoped tokens). Personal-scope tokens leave this empty.
  teamId: z.string().max(100).optional().default(""),
});

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const token = parsed.data.token.trim();
  const teamId = parsed.data.teamId.trim() || null;

  // Validate before storing — a bad token fails here, not on the first build action.
  const check = await verifyVercelToken(token, teamId);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const label = check.identity.username ?? check.identity.email;
  const stored = await storeVercelConnection({
    userId: user.id,
    token,
    teamId,
    accountLabel: label,
  });
  if (!stored.ok) {
    return NextResponse.json({ error: stored.error }, { status: stored.status });
  }

  return NextResponse.json({ status: "active", account: label });
}
