// POST /api/app/metering/nudge-click — record a click-through on the PA-POS-31 conversion nudge
// card ("see the tiers"). Pairs with the impression row the App page writes, so nudge→upgrade
// conversion is measurable in /admin/passes. Zero-cost accounting event; the click itself just
// navigates — this route never gates anything.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isPassAppSlug } from "@/data/project-passes";
import { logCostEvent } from "@/lib/cost/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  app_slug: z.string().refine(isPassAppSlug, "unknown app_slug"),
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
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // One click event per owner+app+day — a double-tap doesn't inflate the funnel.
  const day = new Date().toISOString().slice(0, 10);
  await logCostEvent({
    ownerId: user.id,
    featureSlug: "project_pass_nudge",
    backend: "vercel",
    costMicroCents: 0,
    idempotencyKey: `nudge_click:${user.id}:${parsed.data.app_slug}:${day}`,
    metadata: { action: "click", app_slug: parsed.data.app_slug },
  });
  return NextResponse.json({ ok: true });
}
