import { describe, it, expect, vi } from "vitest";
import { completeLlm, type DispatchDeps } from "./dispatch";
import type {
  AdapterCallParams,
  LlmProvider,
  LlmStreamEvent,
  ProviderAdapter,
  StreamOpenResult,
} from "./types";
import type { LlmProviderSettingsRow } from "./settings";

// ── Helpers ──────────────────────────────────────────────────────────────────────────

function streamOf(events: LlmStreamEvent[]): ReadableStream<LlmStreamEvent> {
  return new ReadableStream<LlmStreamEvent>({
    start(controller) {
      for (const e of events) controller.enqueue(e);
      controller.close();
    },
  });
}

function okAdapter(text: string): ProviderAdapter {
  return {
    async streamCompletion(_p: AdapterCallParams): Promise<StreamOpenResult> {
      return {
        ok: true,
        stream: streamOf([
          { type: "delta", text },
          { type: "usage", inputTokens: 3, outputTokens: 4 },
          { type: "done" },
        ]),
      };
    },
  };
}

function failAdapter(status: number): ProviderAdapter {
  return {
    async streamCompletion(): Promise<StreamOpenResult> {
      return { ok: false, status, error: `error ${status}` };
    },
  };
}

function settings(over: Partial<LlmProviderSettingsRow>): LlmProviderSettingsRow {
  return {
    user_id: "u1",
    provider: "pa_managed",
    encrypted_api_key: null,
    model_id: null,
    custom_endpoint_url: null,
    last_error_at: null,
    last_error_code: null,
    updated_at: "2026-06-05T00:00:00Z",
    ...over,
  };
}

function makeDeps(args: {
  row: LlmProviderSettingsRow | null;
  adapters: Partial<Record<LlmProvider, ProviderAdapter>>;
  markError?: DispatchDeps["markError"];
}): DispatchDeps {
  const fallback = okAdapter("MANAGED");
  return {
    loadSettings: async () => args.row,
    markError: args.markError ?? vi.fn(async () => undefined),
    // Identity decrypt: the stored "encrypted" value is the plaintext key in tests.
    decryptKey: (s) => s,
    adapterFor: (p) => args.adapters[p] ?? fallback,
  };
}

const base = { userId: "u1", paManagedKey: "managed-key", system: "s", messages: [{ role: "user" as const, content: "hi" }] };

// ── Routing ──────────────────────────────────────────────────────────────────────────

describe("dispatch routing", () => {
  it("uses PA-managed Claude when no settings exist", async () => {
    const deps = makeDeps({ row: null, adapters: { pa_managed: okAdapter("MANAGED") } });
    const r = await completeLlm(base, deps);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.provider).toBe("pa_managed");
      expect(r.text).toBe("MANAGED");
      expect(r.qualityWarning).toBe(false);
      expect(r.usedFallback).toBe(false);
    }
  });

  it("routes to the BYO OpenAI provider when selected", async () => {
    const deps = makeDeps({
      row: settings({ provider: "openai", model_id: "gpt-4o", encrypted_api_key: "sk-openai" }),
      adapters: { openai: okAdapter("OPENAI"), pa_managed: okAdapter("MANAGED") },
    });
    const r = await completeLlm(base, deps);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.provider).toBe("openai");
      expect(r.text).toBe("OPENAI");
      expect(r.qualityWarning).toBe(false); // gpt-4o is premium-tier
    }
  });

  it("routes to Groq and to a custom endpoint", async () => {
    const groqDeps = makeDeps({
      row: settings({ provider: "groq", model_id: "llama-3.3-70b", encrypted_api_key: "gsk" }),
      adapters: { groq: okAdapter("GROQ") },
    });
    const gr = await completeLlm(base, groqDeps);
    expect(gr.ok && gr.provider).toBe("groq");

    const customDeps = makeDeps({
      row: settings({
        provider: "custom_openai_compatible",
        model_id: "local-model",
        encrypted_api_key: "x",
        custom_endpoint_url: "http://localhost:11434/v1",
      }),
      adapters: { custom_openai_compatible: okAdapter("CUSTOM") },
    });
    const cr = await completeLlm(base, customDeps);
    expect(cr.ok && cr.provider).toBe("custom_openai_compatible");
  });

  it("routes to xAI Grok (≠ Groq) and treats grok-4.3 as premium-tier", async () => {
    const deps = makeDeps({
      row: settings({ provider: "grok", model_id: "grok-4.3", encrypted_api_key: "xai-key" }),
      adapters: { grok: okAdapter("GROK"), groq: okAdapter("GROQ"), pa_managed: okAdapter("MANAGED") },
    });
    const r = await completeLlm(base, deps);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.provider).toBe("grok"); // NOT "groq" — distinct vendors
      expect(r.text).toBe("GROK");
      expect(r.qualityWarning).toBe(false); // grok-4.3 is premium-tier
    }
  });

  it("flags qualityWarning for a non-premium-tier BYO model", async () => {
    const deps = makeDeps({
      row: settings({ provider: "anthropic", model_id: "claude-haiku-4-5", encrypted_api_key: "sk-ant" }),
      adapters: { anthropic: okAdapter("HAIKU") },
    });
    const r = await completeLlm(base, deps);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.qualityWarning).toBe(true);
  });
});

// ── Fallback ─────────────────────────────────────────────────────────────────────────

describe("dispatch fallback", () => {
  it("falls back to PA-managed on a 401 from the BYO provider and marks the error", async () => {
    const markError = vi.fn(async () => undefined);
    const deps = makeDeps({
      row: settings({ provider: "openai", model_id: "gpt-4o", encrypted_api_key: "bad" }),
      adapters: { openai: failAdapter(401), pa_managed: okAdapter("MANAGED") },
      markError,
    });
    const r = await completeLlm(base, deps);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.provider).toBe("pa_managed");
      expect(r.text).toBe("MANAGED");
      expect(r.usedFallback).toBe(true);
      expect(r.fallbackReason).toMatch(/401/);
    }
    expect(markError).toHaveBeenCalledWith("u1", "401");
  });

  it("falls back to PA-managed on a 401 from the Grok provider and marks the error", async () => {
    const markError = vi.fn(async () => undefined);
    const deps = makeDeps({
      row: settings({ provider: "grok", model_id: "grok-4.3", encrypted_api_key: "bad-xai" }),
      adapters: { grok: failAdapter(401), pa_managed: okAdapter("MANAGED") },
      markError,
    });
    const r = await completeLlm(base, deps);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.provider).toBe("pa_managed");
      expect(r.text).toBe("MANAGED");
      expect(r.usedFallback).toBe(true);
      expect(r.fallbackReason).toMatch(/401/);
    }
    expect(markError).toHaveBeenCalledWith("u1", "401");
  });

  it("does NOT mask a non-401 provider error (surfaces it)", async () => {
    const deps = makeDeps({
      row: settings({ provider: "openai", model_id: "gpt-4o", encrypted_api_key: "x" }),
      adapters: { openai: failAdapter(429), pa_managed: okAdapter("MANAGED") },
    });
    const r = await completeLlm(base, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(429);
  });

  it("degrades a broken BYO config to PA-managed", async () => {
    const deps = makeDeps({
      // BYO provider selected but no model → unusable config.
      row: settings({ provider: "openai", model_id: null, encrypted_api_key: "x" }),
      adapters: { pa_managed: okAdapter("MANAGED") },
    });
    const r = await completeLlm(base, deps);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.provider).toBe("pa_managed");
      expect(r.usedFallback).toBe(true);
    }
  });

  it("errors with 402 when PA-managed has no key and that is the only option", async () => {
    const deps = makeDeps({ row: null, adapters: {} });
    const r = await completeLlm({ ...base, paManagedKey: "" }, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(402);
  });
});
