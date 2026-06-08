import { createClient } from "@/lib/supabase/server";
import { setPaUserSetupBarDismissed } from "@/lib/pa-supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// { dismissed: true }  → hide the Agent-landing setup status bar for this owner, everywhere.
// { dismissed: false } → bring it back (Settings → "Show the setup bar again").
const bodySchema = z.object({ dismissed: z.boolean() });

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
    raw = {};
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { dismissed: boolean }" }, { status: 400 });
  }

  const dismissedAt = parsed.data.dismissed ? new Date().toISOString() : null;
  const result = await setPaUserSetupBarDismissed(user.id, dismissedAt);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, dismissedAt });
}
