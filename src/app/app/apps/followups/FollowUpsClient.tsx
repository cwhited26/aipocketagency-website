"use client";

import { useState } from "react";
import Link from "next/link";

type Citation = { file: string; line: string };
type GenerateResponse = { draft: string; citations: Citation[]; hasBrain: boolean };

export default function FollowUpsClient({
  brainRepo,
  hasApiKey,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
}) {
  const [context, setContext] = useState("");
  const [draft, setDraft] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [hasBrain, setHasBrain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setDraft("");
    setCitations([]);

    const res = await fetch("/api/app/apps/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: context.trim() }),
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
        <div className="mb-2">
          <Link
            href="/app/apps"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Work apps
          </Link>
        </div>

        <div className="mb-8">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Level 2 · Reads from brain
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Follow-up Radar</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            {brainRepo
              ? `Scans ${brainRepo} for relationships, leads, and deals that may have gone cold — then drafts the nudge for each one.`
              : "Scans your brain for who you haven't touched recently, surfaces the gap, and drafts the nudge. Connect a brain to make it specific to your clients and leads."}
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Focus area{" "}
              <span className="text-slate-600 font-normal">(optional — leave blank to scan everything)</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Anyone who got a quote but didn't sign. Leads from last month. Patrick's follow-up on the roofing job."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-[#22d3ee] focus:outline-none resize-none"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full rounded-xl bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Scanning brain for cold leads…" : "Surface follow-ups"}
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
                  Follow-up radar
                  {!hasBrain && (
                    <span className="ml-2 text-amber-500/70">· no brain connected</span>
                  )}
                </span>
                <button
                  onClick={handleCopy}
                  className="text-xs text-slate-500 hover:text-[#22d3ee] transition-colors font-mono"
                >
                  {copied ? "Copied ✓" : "Copy all"}
                </button>
              </div>
              <div className="px-5 py-4">
                <pre className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {draft}
                </pre>
              </div>
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
              These are drafts — review and send on your terms. The more your brain knows about your
              client relationships and deals, the sharper the radar gets.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
