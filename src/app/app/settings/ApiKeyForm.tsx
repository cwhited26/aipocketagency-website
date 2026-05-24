"use client";

import { useState } from "react";

export default function ApiKeyForm({ hasKey }: { hasKey: boolean }) {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(hasKey);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  async function save() {
    const trimmed = key.trim();
    if (!trimmed || isPending) return;
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch("/api/app/settings/anthropic-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Failed to save key. Try again.");
        return;
      }
      setSaved(true);
      setIsReplacing(false);
      setKey("");
    } finally {
      setIsPending(false);
    }
  }

  async function remove() {
    if (isPending) return;
    setError(null);
    setIsPending(true);
    try {
      const res = await fetch("/api/app/settings/anthropic-key", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Failed to remove key. Try again.");
        return;
      }
      setSaved(false);
      setIsReplacing(false);
      setKey("");
    } finally {
      setIsPending(false);
    }
  }

  if (saved && !isReplacing) {
    return (
      <div className="px-5 py-4 flex items-center justify-between gap-4">
        <span className="text-sm text-slate-500">Anthropic API key</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 font-mono">sk-ant-••••••••</span>
          <button
            onClick={() => setIsReplacing(true)}
            className="text-xs text-[#22d3ee] hover:underline"
          >
            Replace
          </button>
          <button
            onClick={remove}
            disabled={isPending}
            className="text-xs text-red-400 hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-slate-500">Anthropic API key</span>
        {isReplacing && (
          <button
            onClick={() => { setIsReplacing(false); setKey(""); setError(null); }}
            className="text-xs text-slate-500 hover:underline"
          >
            Cancel
          </button>
        )}
      </div>
      <input
        type="password"
        placeholder="sk-ant-api03-…"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        disabled={isPending}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none disabled:opacity-50"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-xs text-slate-600">
        Get your key at{" "}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#22d3ee] hover:underline"
        >
          console.anthropic.com
        </a>
        . It is stored server-side and never returned to your browser.
      </p>
      <button
        onClick={save}
        disabled={!key.trim() || isPending}
        className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? "Saving…" : "Save key"}
      </button>
    </div>
  );
}
