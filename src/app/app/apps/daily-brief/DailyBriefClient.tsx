"use client";

import { useState } from "react";
import Link from "next/link";

type Citation = { file: string; line: string };
type BriefResponse = { brief: string; citations: Citation[]; hasBrain: boolean };

export default function DailyBriefClient({
  brainRepo,
  hasApiKey,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
}) {
  const [brief, setBrief] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [hasBrain, setHasBrain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setBrief("");
    setCitations([]);

    const res = await fetch("/api/app/apps/daily-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
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

    const data = (await res.json()) as BriefResponse;
    setBrief(data.brief);
    setCitations(data.citations);
    setHasBrain(data.hasBrain);
    setIsLoading(false);
  }

  async function handleCopy() {
    if (!brief) return;
    await navigator.clipboard.writeText(brief).catch(() => {});
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
            ← Apps
          </Link>
        </div>

        <div className="mb-8">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Level 2 · Reads from brain
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Daily Brief</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            {brainRepo
              ? `Your agent reads ${brainRepo} and writes your morning read — what's on the radar, what's pending, and what to move on today.`
              : "Your agent reads your brain and writes your morning read. Connect a brain to make it specific to your clients, leads, and priorities."}
          </p>
        </div>

        {!brief && (
          <div className="space-y-6">
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full rounded-xl bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Reading brain + writing brief…" : "Generate today's brief"}
            </button>

            <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 px-5 py-4">
              <div className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-2">
                What this covers
              </div>
              <ul className="space-y-1.5 text-sm text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-[#22d3ee]/50 font-mono shrink-0 mt-0.5">◈</span>
                  <span>Active clients and deals — who needs attention today</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#22d3ee]/50 font-mono shrink-0 mt-0.5">◈</span>
                  <span>Pending items waiting for your action or response</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#22d3ee]/50 font-mono shrink-0 mt-0.5">◈</span>
                  <span>Revenue opportunities visible from your brain</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#22d3ee]/50 font-mono shrink-0 mt-0.5">◈</span>
                  <span>One priority — the single thing to move on today</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {error && error !== "no_api_key" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-400 mb-6">
            {error}
          </div>
        )}

        {brief && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  Today&apos;s brief
                  {!hasBrain && (
                    <span className="ml-2 text-amber-500/70">· no brain connected</span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCopy}
                    className="text-xs text-slate-500 hover:text-[#22d3ee] transition-colors font-mono"
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="text-xs text-slate-500 hover:text-[#22d3ee] transition-colors font-mono disabled:opacity-40"
                  >
                    {isLoading ? "…" : "Refresh"}
                  </button>
                </div>
              </div>
              <div className="px-5 py-4">
                <pre className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {brief}
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
              The brief sharpens as your brain grows. Add more context — client notes, pending
              items, voice spec — and it gets more useful every day.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
