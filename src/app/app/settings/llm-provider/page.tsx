import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loadProviderSettings } from "@/lib/llm/settings";
import LlmProviderClient, { type InitialSettings } from "./LlmProviderClient";

export const dynamic = "force-dynamic";

export default async function LlmProviderPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  let row = null;
  try {
    row = await loadProviderSettings(user.id);
  } catch {
    row = null;
  }

  const initial: InitialSettings = {
    provider: row?.provider ?? "pa_managed",
    model: row?.model_id ?? null,
    customEndpointUrl: row?.custom_endpoint_url ?? null,
    hasKey: Boolean(row?.encrypted_api_key),
    lastErrorCode: row?.last_error_code ?? null,
    lastErrorAt: row?.last_error_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-lg mx-auto px-6 py-10 space-y-7">
        <div>
          <a
            href="/app/settings"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Settings
          </a>
          <div className="text-[11px] text-[#22d3ee]/60 font-mono tracking-[0.18em] uppercase mt-3 mb-1">
            LLM provider
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Bring your own model</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            PA runs on PA-managed Claude by default. Point it at your own Anthropic, OpenAI, Groq, or
            any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM) and every agent + persona call
            routes through your model instead.
          </p>
        </div>

        <LlmProviderClient initial={initial} />
      </div>
    </div>
  );
}
