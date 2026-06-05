// GET  /api/app/settings/llm-provider — current provider settings (never returns the key).
// POST /api/app/settings/llm-provider — save provider + model (+ encrypted key + endpoint).

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LLM_PROVIDERS } from "@/lib/llm/types";
import { loadProviderSettings, upsertProviderSettings } from "@/lib/llm/settings";
import { encryptProviderKey, isProviderKeyConfigured } from "@/lib/crypto/provider-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
  model: z.string().trim().min(1).max(120).optional(),
  apiKey: z.string().trim().min(1).max(400).optional(),
  customEndpointUrl: z.string().trim().url().max(400).optional(),
});

export async function GET(): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await loadProviderSettings(user.id);
  return NextResponse.json({
    provider: row?.provider ?? "pa_managed",
    model: row?.model_id ?? null,
    customEndpointUrl: row?.custom_endpoint_url ?? null,
    hasKey: Boolean(row?.encrypted_api_key),
    lastErrorCode: row?.last_error_code ?? null,
    lastErrorAt: row?.last_error_at ?? null,
    updatedAt: row?.updated_at ?? null,
  });
}

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
  const { provider, model, apiKey, customEndpointUrl } = parsed.data;

  // PA-managed needs nothing else; clear any stored BYO config.
  if (provider === "pa_managed") {
    await upsertProviderSettings({
      user_id: user.id,
      provider,
      encrypted_api_key: null,
      model_id: null,
      custom_endpoint_url: null,
    });
    return NextResponse.json({ ok: true, provider });
  }

  if (!model) {
    return NextResponse.json({ error: "A model is required for a BYO provider." }, { status: 422 });
  }
  if (provider === "custom_openai_compatible" && !customEndpointUrl) {
    return NextResponse.json(
      { error: "A custom endpoint URL is required for the custom provider." },
      { status: 422 },
    );
  }

  // Resolve the stored key: a new key is encrypted now; otherwise keep the existing one.
  let encrypted: string | null;
  if (apiKey) {
    if (!isProviderKeyConfigured()) {
      return NextResponse.json(
        { error: "Server key encryption is not configured (LLM_PROVIDER_KEY_ENCRYPTION_KEY)." },
        { status: 500 },
      );
    }
    encrypted = encryptProviderKey(apiKey);
  } else {
    const existing = await loadProviderSettings(user.id);
    encrypted = existing?.encrypted_api_key ?? null;
    if (!encrypted) {
      return NextResponse.json({ error: "An API key is required for this provider." }, { status: 422 });
    }
  }

  await upsertProviderSettings({
    user_id: user.id,
    provider,
    encrypted_api_key: encrypted,
    model_id: model,
    custom_endpoint_url: customEndpointUrl ?? null,
  });
  return NextResponse.json({ ok: true, provider, model });
}
