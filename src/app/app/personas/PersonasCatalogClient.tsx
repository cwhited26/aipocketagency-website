"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PersonaRow } from "@/lib/personas/types";

type CatalogResponse = {
  personas: PersonaRow[];
  tierLabel: string;
  personaLimit: number | null;
  canCreate: boolean;
};

const STATUS_STYLE: Record<string, string> = {
  active: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  draft: "text-slate-400 border-slate-600/50 bg-slate-700/20",
  paused: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  archived: "text-slate-500 border-slate-700/50 bg-slate-800/20",
};

export default function PersonasCatalogClient() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/personas")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to load");
        return r.json() as Promise<CatalogResponse>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function copyShareLink(id: string) {
    const res = await fetch(`/api/personas/${id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = (await res.json().catch(() => ({}))) as { chatUrl?: string; error?: string };
    if (res.ok && body.chatUrl) {
      await navigator.clipboard.writeText(body.chatUrl).catch(() => {});
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    }
  }

  const personas = data?.personas ?? [];
  const canCreate = data?.canCreate ?? true;
  const limit = data?.personaLimit ?? null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-5 py-8">
        <header className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Personas</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Specialist AI agents built from your business brain. Share each one with your
              team — it only knows what you teach it.
            </p>
          </div>
          {canCreate ? (
            <Link
              href="/app/personas/new"
              className="shrink-0 rounded-lg bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-4 py-2.5 hover:bg-[#67e8f9] transition-colors"
            >
              New persona
            </Link>
          ) : (
            <div className="shrink-0 text-right">
              <button
                disabled
                className="rounded-lg bg-slate-800 text-slate-500 text-sm font-semibold px-4 py-2.5 cursor-not-allowed"
              >
                New persona
              </button>
              <p className="text-[11px] text-amber-400/80 mt-1.5 max-w-[180px]">
                You&apos;re using all {limit} personas on {data?.tierLabel}. Upgrade for more.
              </p>
            </div>
          )}
        </header>

        {loading && <p className="text-slate-500 text-sm">Loading…</p>}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && personas.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center">
            <p className="text-slate-300 font-medium">No personas yet</p>
            <p className="text-slate-500 text-sm mt-1 mb-5 max-w-md mx-auto">
              Spin up a Virtual Sales Manager, Customer Service Agent, and more from a
              template in under 10 minutes.
            </p>
            <Link
              href="/app/personas/new"
              className="inline-block rounded-lg bg-[#22d3ee] text-[#06222a] text-sm font-semibold px-4 py-2.5 hover:bg-[#67e8f9] transition-colors"
            >
              Create your first persona
            </Link>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {personas.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <Link href={`/app/personas/${p.id}`} className="min-w-0">
                  <h3 className="text-slate-100 font-medium truncate hover:text-[#22d3ee] transition-colors">
                    {p.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">
                    {p.template_key}
                  </p>
                </Link>
                <span
                  className={`shrink-0 text-[10px] font-mono uppercase tracking-wider border rounded px-1.5 py-0.5 ${STATUS_STYLE[p.status] ?? STATUS_STYLE.draft}`}
                >
                  {p.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/app/personas/${p.id}`}
                  className="text-xs rounded-md border border-slate-700 text-slate-300 px-3 py-1.5 hover:bg-slate-800 transition-colors"
                >
                  Open
                </Link>
                <button
                  onClick={() => copyShareLink(p.id)}
                  className="text-xs rounded-md border border-slate-700 text-slate-300 px-3 py-1.5 hover:bg-slate-800 transition-colors"
                >
                  {copied === p.id ? "Link copied!" : "Share link"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
