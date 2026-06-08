"use client";

import { useState } from "react";
import Link from "next/link";

type Citation = { file: string; line: string };
type BriefResponse = { brief: string; citations: Citation[]; hasBrain: boolean };

export default function CalendarClient({
  brainRepo,
  hasApiKey,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
}) {
  const [upcoming, setUpcoming] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [hasBrain, setHasBrain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    if (!hasApiKey || isLoading) return;
    setIsLoading(true);
    setError(null);
    setUpcoming("");
    setCitations([]);

    const res = await fetch("/api/app/apps/calendar", {
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
    setUpcoming(data.brief);
    setCitations(data.citations);
    setHasBrain(data.hasBrain);
    setIsLoading(false);
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
            Brain-powered · Upcoming
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Calendar</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            {brainRepo
              ? `Scans ${brainRepo} for anything date or deadline related — upcoming jobs, scheduled calls, pending deadlines, follow-up timelines.`
              : "Your agent scans your brain for any upcoming dates, deadlines, or scheduled items it knows about. Connect a brain to make it specific."}
          </p>
        </div>

        {/* Brain scan section */}
        {hasApiKey && brainRepo && (
          <div className="mb-6">
            <button
              onClick={handleScan}
              disabled={isLoading}
              className="w-full rounded-xl bg-[#22d3ee] px-5 py-3 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Scanning brain for upcoming items…" : "Scan brain for what's upcoming"}
            </button>
          </div>
        )}

        {!hasApiKey && (
          <div className="mb-6 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-5 py-4 flex items-start gap-3">
            <span className="text-[#22d3ee] shrink-0 mt-0.5 font-mono text-sm">→</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">API key required</p>
              <p className="text-sm text-slate-300 mt-1">
                <Link href="/app/settings" className="text-[#22d3ee] hover:underline">
                  Add your Anthropic key in Settings →
                </Link>
              </p>
            </div>
          </div>
        )}

        {error && error !== "no_api_key" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-400 mb-6">
            {error}
          </div>
        )}

        {upcoming && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Upcoming from brain
                {!hasBrain && (
                  <span className="ml-2 text-amber-500/70">· no brain connected</span>
                )}
              </span>
            </div>
            <div className="px-5 py-4">
              <pre className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                {upcoming}
              </pre>
            </div>
            {citations.length > 0 && (
              <div className="border-t border-slate-800 px-5 py-3">
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
          </div>
        )}

        {/* Coming soon seam */}
        <div className="rounded-xl border border-slate-800/40 bg-transparent px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-1.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-400">
                Live Google Calendar sync arrives with Connections
              </p>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Once you connect Google Calendar, your agent will read your real schedule —
                upcoming meetings, job site visits, calls — alongside what&apos;s in your brain.
                {brainRepo
                  ? " Together, it becomes a full picture of your time."
                  : " Connect a brain and calendar to get the full picture."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
