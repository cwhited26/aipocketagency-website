"use client";

import { useState } from "react";

export type ApiKeyView = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export default function ApiKeysClient({ initialKeys }: { initialKeys: ApiKeyView[] }) {
  const [keys, setKeys] = useState<ApiKeyView[]>(initialKeys);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newPlaintext, setNewPlaintext] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/app/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        plaintext?: string;
        key?: ApiKeyView;
        error?: string;
      };
      if (!res.ok || !body.plaintext || !body.key) {
        setError(body.error ?? "Failed to generate key.");
        return;
      }
      setKeys((prev) => [body.key as ApiKeyView, ...prev]);
      setNewPlaintext(body.plaintext);
      setName("");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    const res = await fetch(`/api/app/api-keys/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Failed to revoke key.");
      return;
    }
    setKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)),
    );
  }

  async function copyKey() {
    if (!newPlaintext) return;
    await navigator.clipboard.writeText(newPlaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function closeModal() {
    setShowModal(false);
    setNewPlaintext(null);
    setName("");
    setError(null);
    setCopied(false);
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => setShowModal(true)}
        className="rounded-lg bg-[#22d3ee] px-5 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
      >
        Generate new key
      </button>

      {keys.length === 0 ? (
        <p className="text-sm text-slate-500">No API keys yet. Generate one to start using the REST API.</p>
      ) : (
        <div className="rounded-xl border border-slate-700/60 divide-y divide-slate-800">
          {keys.map((k) => (
            <div key={k.id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100 truncate">{k.name}</span>
                  {k.revokedAt && (
                    <span className="text-[10px] uppercase tracking-wide text-red-400 border border-red-500/40 rounded px-1.5 py-0.5">
                      Revoked
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{k.keyPrefix}…</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Created {new Date(k.createdAt).toLocaleDateString()} ·{" "}
                  {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString()}` : "never used"}
                </p>
              </div>
              {!k.revokedAt && (
                <button
                  onClick={() => revoke(k.id)}
                  className="text-xs text-red-400 hover:underline whitespace-nowrap"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0a0e14] p-6 space-y-4">
            {newPlaintext ? (
              <>
                <h2 className="text-lg font-bold text-slate-100">Copy your key now</h2>
                <p className="text-sm text-slate-400">
                  This is the only time we’ll show it. Store it somewhere safe — we keep only a hash.
                </p>
                <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-[#22d3ee] break-all">
                  {newPlaintext}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={copyKey}
                    className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
                  >
                    {copied ? "Copied!" : "Copy to clipboard"}
                  </button>
                  <button onClick={closeModal} className="text-sm text-slate-400 hover:underline">
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-100">Generate API key</h2>
                <label className="block space-y-1">
                  <span className="text-xs text-slate-400">Key name</span>
                  <input
                    type="text"
                    placeholder="e.g. Claude Code on my laptop"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={creating}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
                  />
                </label>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex items-center gap-3">
                  <button
                    onClick={generate}
                    disabled={!name.trim() || creating}
                    className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-40 transition-colors"
                  >
                    {creating ? "Generating…" : "Generate"}
                  </button>
                  <button onClick={closeModal} className="text-sm text-slate-400 hover:underline">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
