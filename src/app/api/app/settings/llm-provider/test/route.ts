// POST /api/app/settings/llm-provider/test — 5-token sanity ping against the picked
// provider + model + key (NOT the saved row). Returns latency + echoed model so the UI
// can gate Save on a successful connection.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LLM_PROVIDERS } from "@/lib/llm/types";
import { pingProvider } from "@/lib/llm/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().trim().min(1).max(400),
  customEndpointUrl: z.string().trim().url().max(400).optional(),
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

  const result = await pingProvider({
    provider: parsed.data.provider,
    model: parsed.data.model,
    apiKey: parsed.data.apiKey,
    endpointUrl: parsed.data.customEndpointUrl,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }
  return NextResponse.json({
    ok: true,
    latencyMs: result.latencyMs,
    modelEcho: result.modelEcho,
    qualityWarning: result.qualityWarning,
  });
}
