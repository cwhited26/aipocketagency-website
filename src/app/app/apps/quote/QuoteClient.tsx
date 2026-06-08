"use client";

import { useState } from "react";
import Link from "next/link";

type Citation = { file: string; line: string };
type GenerateResponse = { draft: string; citations: Citation[]; hasBrain: boolean };

export default function QuoteClient({
  brainRepo,
  hasApiKey,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
}) {
  const [clientName, setClientName] = useState("");
  const [scopeDescription, setScopeDescription] = useState("");
  const [specifics, setSpecifics] = useState("");
  const [draft, setDraft] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [hasBrain, setHasBrain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!clientName.trim() || !scopeDescription.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    setDraft("");
    setCitations([]);

    const res = await fetch("/api/app/apps/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: clientName.trim(),
        scopeDescription: scopeDescription.trim(),
        specifics: specifics.trim(),
      }),
    }).catch(() => null);

    if (!res) {
      setError("Network error. Check your connection and try again.");
      setIsLoading(false);
      return;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (body.error === "no_api_key") {
        setError("no_api_key");
      } else {
        setError(body.message ?? body.error ?? "Something went wrong. Try again.");
      }
      setIsLoading(false);
      return;
    }

    const data = (await res.json()) as GenerateResponse;
    setDraft(data.draft);
    setCitations(data.citations);
    setHasBrain(data.hasBrain);
    setIsLoading(false);
  }

  async function handleCopy() {
    if (!draft) return;
    await navigator.clipboard.writeText(draft).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!hasApiKey) {
    return (
      <div className="h-full overflow-y-auto bg-[#05070a] flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-4 text-center">
          <div className="text-[#22d3ee] text-xs font-mono tracking-[0.2em] uppercase">
            Setup required
          </div>
          <h2 className="text-xl font-bold text-slate-100">Add your Anthropic API key</h2>
          <p className="text-slate-400 text-sm">
            Pocket Agent uses your own Anthropic key — your data stays yours and you control the
            bill.
          </p>
          <Link
            href="/app/settings"
            className="inline-flex w-full items-center justify-center rounded-lg bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors"
          >
            Go to Settings →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-2 flex items-center gap-3">
          <Link
            href="/app/apps"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Work apps
          </Link>
        </div>

        <div className="mb-8">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Level 2 · Drafts in your voice
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Quote / Proposal Writer</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            {brainRepo
              ? `Reads your brain at ${brainRepo} — services, pricing, past decisions — and produces a clean quote draft.`
              : "No brain connected yet. Will still draft a complete quote — just without your specific pricing and services. Connect a brain to sharpen it."}
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Client / customer name
            </label>
            <input
              type="text"
              placeholder="Patrick Johnson"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Job / scope description
            </label>
            <textarea
              rows={4}
              placeholder="New roof on a 2,400 sq ft single-story home. Standard architectural shingles, remove one layer of existing shingles, replace damaged decking as needed, new drip edge and ice-and-water shield in valleys."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none resize-none"
              value={scopeDescription}
              onChange={(e) => setScopeDescription(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Specifics{" "}
              <span className="text-slate-600 font-normal">(optional — timeline, line items, budget signals, anything extra)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Timeline: start within 2 weeks, 2-day job. Client mentioned budget around $12k. Include gutter work as optional line item."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none resize-none"
              value={specifics}
              onChange={(e) => setSpecifics(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!clientName.trim() || !scopeDescription.trim() || isLoading}
            className="w-full rounded-xl bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Reading brain + drafting…" : "Generate quote"}
          </button>
        </div>

        {error && error !== "no_api_key" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-400 mb-6">
            {error}
          </div>
        )}

        {draft && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  Draft
                  {!hasBrain && (
                    <span className="ml-2 text-amber-500/70">· no brain connected</span>
                  )}
                </span>
                <button
                  onClick={handleCopy}
                  className="text-xs text-slate-500 hover:text-[#22d3ee] transition-colors font-mono"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <textarea
                rows={20}
                className="w-full bg-transparent px-5 py-4 text-sm text-slate-200 leading-relaxed focus:outline-none resize-y font-mono"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>

            {citations.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
                <div className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-2">
                  Sources from brain
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {citations.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-[11px] font-mono text-[#22d3ee]/60"
                    >
                      {c.file}
                      {c.line ? `:${c.line}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-700 leading-relaxed">
              Edit the draft above — it&apos;s yours. The more your brain knows about your pricing,
              services, and past jobs, the sharper the starting point gets.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
