import { createClient } from "@/lib/supabase/server";
import {
  storeLeadScoutConnection,
  tierAllowsSharedBrightData,
} from "@/lib/pa-lead-scout-connections";
import { getCurrentTier } from "@/lib/personas/tier-caps";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Store the owner's Bright Data connection: either a pasted API key (encrypted at rest) or the
// shared-account opt-in (Studio+ only — PA's platform Bright Data key fronts the requests).
const bodySchema = z.object({
  apiKey: z.string().max(500).optional().default(""),
  useShared: z.boolean().optional().default(false),
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

  const apiKey = parsed.data.apiKey.trim();
  const useShared = parsed.data.useShared;

  if (useShared) {
    const tier = await getCurrentTier(user.id);
    if (!tierAllowsSharedBrightData(tier)) {
      return NextResponse.json(
        { error: "The shared Bright Data account is a Studio+ perk. Paste your own key instead." },
        { status: 403 },
      );
    }
  } else if (!apiKey) {
    return NextResponse.json(
      { error: "Paste your Bright Data API key, or switch on the shared account." },
      { status: 422 },
    );
  }

  const result = await storeLeadScoutConnection({
    userId: user.id,
    apiKey: useShared ? null : apiKey,
    useShared,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ status: "active" });
}
