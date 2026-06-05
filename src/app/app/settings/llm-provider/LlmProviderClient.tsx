"use client";

import { useState } from "react";

// Provider catalog (mirrors lib/llm/types.ts — kept inline so this stays a pure client
// component with no server imports).
const PROVIDERS = [
  { key: "pa_managed", label: "PA-managed Claude", blurb: "Default. We run it. Nothing to configure.", byo: false, custom: false },
  { key: "anthropic", label: "Anthropic (BYO)", blurb: "Your Anthropic key — Sonnet / Opus / Haiku.", byo: true, custom: false },
  { key: "openai", label: "OpenAI (BYO)", blurb: "Your OpenAI key — GPT-4o / GPT-4.1.", byo: true, custom: false },
  { key: "groq", label: "Groq (BYO)", blurb: "Your Groq key — fast open models.", byo: true, custom: false },
  { key: "custom_openai_compatible", label: "Local or custom", blurb: "Ollama / LM Studio / vLLM / any OpenAI-compatible URL.", byo: true, custom: true },
] as const;

type ProviderKey = (typeof PROVIDERS)[number]["key"];

// Premium-tier allowlist mirror (lib/llm/types.ts PREMIUM_TIER_MODELS) for an instant
// client-side quality-bar banner.
const PREMIUM_MODELS = ["claude-sonnet-4-6", "claude-opus-4-6", "claude-opus-4-7", "gpt-4o", "gpt-4.1"];
const QUALITY_WARNING =
  "PA's behavior is calibrated for top-tier models — smaller/older models may produce lower-quality persona responses.";

function isPremium(model: string): boolean {
  const m = model.trim().toLowerCase();
  return PREMIUM_MODELS.some((p) => p === m);
}

export type InitialSettings = {
  provider: ProviderKey;
  model: string | null;
  customEndpointUrl: string | null;
  hasKey: boolean;
  lastErrorCode: string | null;
  lastErrorAt: string | null;
  updatedAt: string | null;
};

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; latencyMs: number; modelEcho: string }
  | { kind: "fail"; error: string };

export default function LlmProviderClient({ initial }: { initial: InitialSettings }) {
  const [provider, setProvider] = useState<ProviderKey>(initial.provider);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial.model ?? "");
  const [endpoint, setEndpoint] = useState(initial.customEndpointUrl ?? "");
  const [models, setModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: "idle" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = PROVIDERS.find((p) => p.key === provider)!;
  const apiKeyDirty = apiKey.trim().length > 0;
  const needsTest = meta.byo && apiKeyDirty; // a freshly entered key must be tested

  function resetTest() {
    setTest({ kind: "idle" });
    setSaved(false);
  }

  function pickProvider(key: ProviderKey) {
    setProvider(key);
    setModels([]);
    setModel(key === initial.provider ? initial.model ?? "" : "");
    setApiKey("");
    resetTest();
    setError(null);
  }

  async function fetchModels() {
    if (!apiKeyDirty || fetchingModels) return;
    setFetchingModels(true);
    setError(null);
    try {
      const res = await fetch("/api/app/settings/llm-provider/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim(), customEndpointUrl: endpoint.trim() || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { models?: string[]; error?: string };
      setModels(body.models ?? []);
      if (!body.models?.length && body.error) setError(`Couldn't list models: ${body.error}. Enter one manually.`);
    } finally {
      setFetchingModels(false);
    }
  }

  async function runTest() {
    if (!model.trim() || !apiKeyDirty) return;
    setTest({ kind: "testing" });
    setError(null);
    try {
      const res = await fetch("/api/app/settings/llm-provider/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: model.trim(),
          apiKey: apiKey.trim(),
          customEndpointUrl: endpoint.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        latencyMs?: number;
        modelEcho?: string;
        error?: string;
      };
      if (body.ok) {
        setTest({ kind: "ok", latencyMs: body.latencyMs ?? 0, modelEcho: body.modelEcho ?? model });
      } else {
        setTest({ kind: "fail", error: body.error ?? "Connection failed." });
      }
    } catch {
      setTest({ kind: "fail", error: "Network error during test." });
    }
  }

  // Save is gated: PA-managed always; BYO needs a passing test OR an unchanged existing
  // key with a model set.
  const canSave =
    provider === "pa_managed" ||
    test.kind === "ok" ||
    (!apiKeyDirty && initial.hasKey && provider === initial.provider && model.trim().length > 0);

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/app/settings/llm-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: provider === "pa_managed" ? undefined : model.trim(),
          apiKey: apiKeyDirty ? apiKey.trim() : undefined,
          customEndpointUrl: meta.custom ? endpoint.trim() : undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Failed to save.");
        return;
      }
      setSaved(true);
      setApiKey("");
    } finally {
      setSaving(false);
    }
  }

  const showQualityBanner = meta.byo && model.trim().length > 0 && !isPremium(model);

  return (
    <div className="space-y-6">
      {initial.lastErrorCode === "401" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
          <p className="text-sm font-semibold text-amber-300">Your BYO key stopped working</p>
          <p className="text-sm text-slate-300 mt-1">
            We got a 401 from your provider, so PA temporarily fell back to PA-managed Claude. Re-enter a
            valid key below to switch back.
          </p>
        </div>
      )}

      {/* Provider picker */}
      <div className="grid gap-3">
        {PROVIDERS.map((p) => {
          const active = p.key === provider;
          return (
            <button
              key={p.key}
              onClick={() => pickProvider(p.key)}
              className={`text-left rounded-xl border px-5 py-4 transition-colors ${
                active
                  ? "border-[#22d3ee]/60 bg-[#22d3ee]/5"
                  : "border-slate-700/60 bg-slate-900/40 hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-100">{p.label}</span>
                {p.key === "pa_managed" && (
                  <span className="text-[10px] uppercase tracking-wide text-[#22d3ee] border border-[#22d3ee]/40 rounded px-1.5 py-0.5">
                    Default
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">{p.blurb}</p>
            </button>
          );
        })}
      </div>

      {/* BYO config */}
      {meta.byo && (
        <div className="space-y-4 rounded-xl border border-slate-700/60 bg-slate-900/40 px-5 py-5">
          {meta.custom && (
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Endpoint URL</span>
              <input
                type="url"
                placeholder="http://localhost:11434/v1"
                value={endpoint}
                onChange={(e) => {
                  setEndpoint(e.target.value);
                  resetTest();
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
              />
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-xs text-slate-400">
              API key {initial.hasKey && provider === initial.provider ? "(leave blank to keep current)" : ""}
            </span>
            <input
              type="password"
              placeholder="sk-…"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                resetTest();
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
            />
            <span className="text-[11px] text-slate-600">
              Encrypted at rest (AES-256-GCM). Never returned to your browser.
            </span>
          </label>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Model</span>
              <button
                onClick={fetchModels}
                disabled={!apiKeyDirty || fetchingModels}
                className="text-[11px] text-[#22d3ee] hover:underline disabled:opacity-40"
              >
                {fetchingModels ? "Fetching…" : "Fetch models"}
              </button>
            </div>
            {models.length > 0 ? (
              <select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  resetTest();
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-[#22d3ee] focus:outline-none"
              >
                <option value="">Select a model…</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="e.g. claude-sonnet-4-6 / gpt-4.1 / llama-3.3-70b"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  resetTest();
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
              />
            )}
          </div>

          {showQualityBanner && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <p className="text-xs text-amber-200 leading-relaxed">{QUALITY_WARNING}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={runTest}
              disabled={!model.trim() || !apiKeyDirty || test.kind === "testing"}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-[#22d3ee] disabled:opacity-40 transition-colors"
            >
              {test.kind === "testing" ? "Testing…" : "Test connection"}
            </button>
            {test.kind === "ok" && (
              <span className="text-xs text-emerald-400">
                ✓ {test.modelEcho} · {Number(test.latencyMs).toLocaleString()}ms
              </span>
            )}
            {test.kind === "fail" && <span className="text-xs text-red-400">{test.error}</span>}
            {needsTest && test.kind === "idle" && (
              <span className="text-xs text-slate-500">Test before saving.</span>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="rounded-lg bg-[#22d3ee] px-5 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save provider"}
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved.</span>}
      </div>

      {initial.updatedAt && !saved && (
        <p className="text-xs text-slate-600">
          Current: {PROVIDERS.find((p) => p.key === initial.provider)?.label}
          {initial.model ? ` · ${initial.model}` : ""} · updated{" "}
          {new Date(initial.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
