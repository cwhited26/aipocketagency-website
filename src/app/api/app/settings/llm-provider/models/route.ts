// POST /api/app/settings/llm-provider/models — list available models for the picked
// provider + key (via the provider's /models endpoint). Returns { models: [] } when the
// provider/endpoint doesn't expose model listing, so the UI falls back to manual entry.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LLM_PROVIDERS } from "@/lib/llm/types";
import { adapterFor } from "@/lib/llm/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
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

  const adapter = adapterFor(parsed.data.provider);
  if (!adapter.listModels) {
    return NextResponse.json({ models: [], supported: false });
  }
  const result = await adapter.listModels({
    apiKey: parsed.data.apiKey,
    endpointUrl: parsed.data.customEndpointUrl,
  });
  if (!result.ok) {
    return NextResponse.json({ models: [], supported: false, error: result.error });
  }
  return NextResponse.json({ models: result.models, supported: true });
}
