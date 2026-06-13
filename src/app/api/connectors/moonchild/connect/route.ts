// POST /api/connectors/moonchild/connect  { token, mcpUrl? }
// Save the owner's Moonchild msk_* token. The token is validated against the MCP server
// (tools/list) before it's stored — we never persist a dead token. Stored AES-256-GCM in
// pa_connections.config (see pa-moonchild-connections.ts). (PA-LPB-13)

import { createClient } from "@/lib/supabase/server";
import { storeMoonchildConnection, DEFAULT_MOONCHILD_MCP_URL } from "@/lib/pa-moonchild-connections";
import { listMoonchildScenesWithCredentials } from "@/lib/connectors/moonchild/client";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1).max(1000),
  mcpUrl: z.string().url().max(500).optional().default(DEFAULT_MOONCHILD_MCP_URL),
  accountLabel: z.string().max(200).optional(),
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

  const { token, mcpUrl, accountLabel } = parsed.data;

  // Validate by calling scene_list — proves the token is live and has the right scopes.
  // We don't fail if there are no scenes yet; we fail if the request itself errors (auth / network).
  const check = await listMoonchildScenesWithCredentials({ mcpUrl, token }, user.id);
  if (!check.ok) {
    const authFail = check.error.kind === "auth" || check.error.kind === "not_configured";
    return NextResponse.json(
      { error: authFail ? "That token didn't work. Check the msk_* value and try again." : check.error.message },
      { status: authFail ? 422 : 502 },
    );
  }

  const stored = await storeMoonchildConnection({
    userId: user.id,
    token,
    mcpUrl: mcpUrl !== DEFAULT_MOONCHILD_MCP_URL ? mcpUrl : undefined,
    accountLabel: accountLabel ?? `Moonchild (${check.data.length} scene${check.data.length === 1 ? "" : "s"})`,
  });
  if (!stored.ok) {
    return NextResponse.json({ error: stored.error }, { status: stored.status });
  }

  return NextResponse.json({ status: "active", sceneCount: check.data.length });
}
