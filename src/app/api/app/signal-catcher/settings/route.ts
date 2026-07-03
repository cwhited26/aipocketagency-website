// /api/app/signal-catcher/settings — read + save the owner's Signal Catcher dial (PA-SIGNAL-1).
// GET returns the effective settings (defaults when no row) + whether the owner's tier runs the
// catcher at all. POST upserts the toggle + sensitivity. Owner-scoped via the session; the tier
// gate lives on the catch pipeline itself — saving a preference below Studio+ is allowed (it just
// does nothing until they upgrade), matching how other settings surfaces treat dormant features.

import { createClient } from "@/lib/supabase/server";
import { getCurrentTier, tierAllowsSignalCatcher } from "@/lib/personas/tier-caps";
import {
  fetchSignalCatcherSettings,
  saveSignalCatcherSettings,
} from "@/lib/signal-catcher/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settings, tier] = await Promise.all([
    fetchSignalCatcherSettings(user.id),
    getCurrentTier(user.id),
  ]);
  if (!settings.ok) {
    return NextResponse.json({ error: settings.error }, { status: settings.status });
  }
  return NextResponse.json({
    settings: settings.data,
    tierAllows: tierAllowsSignalCatcher(tier),
  });
}

const bodySchema = z.object({
  enabled: z.boolean(),
  sensitivity: z.enum(["low", "medium", "high"]),
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

  const saved = await saveSignalCatcherSettings(user.id, parsed.data);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
  return NextResponse.json({ settings: parsed.data });
}
