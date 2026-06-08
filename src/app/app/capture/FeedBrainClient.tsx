"use client";

import { useState, useEffect, useCallback } from "react";
import FileUploadZone from "../_components/FileUploadZone";
import { TabGuide } from "../_components/TabGuide";
import YouTubeExplainerCard from "@/components/youtube/ExplainerCard";

type CompletenessData = { filled: number; total: number; pct: number };

type AbsorbRecord = {
  id: string;
  absorbed: boolean;
  message: string;
  memoryPath?: string;
  assetPath?: string;
  timestamp: string;
};

export default function FeedBrainClient({
  brainRepo,
  hasApiKey,
}: {
  brainRepo: string | null;
  hasApiKey: boolean;
}) {
  const [completeness, setCompleteness] = useState<CompletenessData | null>(null);
  const [history, setHistory] = useState<AbsorbRecord[]>([]);

  const fetchCompleteness = useCallback(() => {
    if (!brainRepo) return;
    fetch("/api/app/brain/completeness")
      .then((r) => (r.ok ? (r.json() as Promise<CompletenessData>) : Promise.reject()))
      .then(setCompleteness)
      .catch(() => {});
  }, [brainRepo]);

  useEffect(() => {
    fetchCompleteness();
  }, [fetchCompleteness]);

  function handleAbsorbed(result: { absorbed?: boolean; message?: string; memoryPath?: string; assetPath?: string }) {
    fetchCompleteness();
    setHistory((prev) => [
      {
        id: `${Date.now()}`,
        absorbed: result.absorbed === true,
        message: result.message ?? "",
        memoryPath: result.memoryPath,
        assetPath: result.assetPath,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev,
    ]);
  }

  return (
    <div className="h-full overflow-y-auto bg-[#06080b]">
      <div className="max-w-xl mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Header */}
        <div>
          <div className="text-[#22d3ee] text-[10px] font-mono tracking-[0.22em] uppercase mb-1.5">
            Pocket Agent · Brain
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Feed your brain.</h1>
          <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
            The fastest way to get something into your brain, from anywhere.
          </p>
          <p className="text-sm text-slate-300 mt-3 leading-relaxed">
            When something matters and you don&apos;t want to lose it, drop it here. A voice memo
            while you&apos;re driving back from a job. A photo of a competitor&apos;s yard sign. A
            proposal PDF, a whiteboard shot, a doc shared straight from your phone. Your agent reads
            whatever you send, pulls out what matters, and files it into your brain — so next time
            you ask, it already knows. Set up the iPhone share sheet and it&apos;s two taps from any
            app.
          </p>
        </div>

        {/* No brain */}
        {!brainRepo ? (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-5 py-5 space-y-2">
            <p className="text-sm font-medium text-slate-300">No brain connected yet.</p>
            <p className="text-sm text-slate-400">
              Set up your brain repo first, then come back here to feed it.
            </p>
            <a
              href="/app/onboarding"
              className="inline-block text-sm text-[#22d3ee] hover:underline font-mono"
            >
              Set up brain →
            </a>
          </div>
        ) : (
          <>
            {/* No API key warning */}
            {!hasApiKey && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/6 px-4 py-3">
                <p className="text-sm font-medium text-amber-300">Anthropic key not set</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Files will be stored in your brain repo, but the agent won&apos;t absorb them into
                  memory until you add your key.{" "}
                  <a href="/app/settings" className="text-[#22d3ee] hover:underline">
                    Add key →
                  </a>
                </p>
              </div>
            )}

            {/* Upload zone */}
            <FileUploadZone onAbsorbed={handleAbsorbed} />

            {/* Brain completeness */}
            {completeness && (
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-slate-400 tracking-[0.14em] uppercase">
                    Brain completeness
                  </span>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      color: completeness.pct >= 100 ? "#22d3ee" : "rgba(34,211,238,0.6)",
                      background:
                        completeness.pct >= 100 ? "rgba(34,211,238,0.12)" : "rgba(34,211,238,0.06)",
                      border:
                        "1px solid " +
                        (completeness.pct >= 100
                          ? "rgba(34,211,238,0.3)"
                          : "rgba(34,211,238,0.15)"),
                    }}
                  >
                    {completeness.filled}/{completeness.total} cores
                  </span>
                </div>
                <div className="h-px rounded-full overflow-hidden bg-slate-800">
                  <div
                    className="h-full rounded-full transition-[width] duration-[1200ms] ease-in-out"
                    style={{
                      width: `${completeness.pct}%`,
                      background: "linear-gradient(to right, rgba(34,211,238,0.6), #22d3ee)",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Absorption history this session */}
            {history.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-slate-600 tracking-[0.15em] uppercase">
                  This session
                </p>
                {history.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-lg border border-slate-800/60 bg-slate-900/30 px-3 py-2.5 flex items-start gap-2.5"
                  >
                    <span
                      className="text-xs shrink-0 mt-0.5"
                      style={{ color: record.absorbed ? "#22d3ee" : "#64748B" }}
                    >
                      {record.absorbed ? "◈" : "○"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 leading-relaxed">{record.message}</p>
                      {record.memoryPath && (
                        <p className="text-[10px] font-mono text-[#22d3ee]/50 mt-0.5">
                          → {record.memoryPath}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-700 shrink-0">
                      {record.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* iOS share shortcuts */}
            <div className="flex flex-col gap-2">
              <a
                href="/app/capture/voice"
                className="flex items-center gap-3 rounded-xl border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-4 py-3 hover:border-[#22d3ee]/40 hover:bg-[#22d3ee]/10 transition-all group"
              >
                <span className="text-[#22d3ee]/70 text-sm shrink-0 group-hover:text-[#22d3ee] transition-colors">●</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">
                    Record a voice memo
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Talk it out — transcribed and filed into your brain →
                  </p>
                </div>
              </a>
              <a
                href="/app/share-setup"
                className="flex items-center gap-3 rounded-xl border border-slate-700/40 bg-slate-900/40 px-4 py-3 hover:border-[#22d3ee]/30 hover:bg-slate-900/60 transition-all group"
              >
                <span className="text-[#22d3ee]/50 text-sm shrink-0 group-hover:text-[#22d3ee]/80 transition-colors">⇧</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300 group-hover:text-slate-200 transition-colors">
                    Add it to your phone&apos;s share sheet
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Share URLs and articles from any app in two taps →
                  </p>
                </div>
              </a>
              <a
                href="/app/brain/inbox"
                className="flex items-center gap-3 rounded-xl border border-slate-800/50 bg-slate-900/30 px-4 py-3 hover:border-slate-700/60 hover:bg-slate-900/50 transition-all group"
              >
                <span className="text-slate-600 text-sm shrink-0 group-hover:text-slate-400 transition-colors">◈</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                    View Capture Inbox
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Browse + remove items shared from iOS →
                  </p>
                </div>
              </a>
            </div>

            {/* What to upload */}
            <div className="rounded-xl border border-slate-800/50 bg-slate-900/30 px-4 py-4">
              <p className="text-[11px] font-mono text-slate-500 tracking-[0.14em] uppercase mb-3">
                What to upload
              </p>
              <ul className="space-y-2">
                {[
                  { icon: "◈", text: "Business one-pager or services PDF" },
                  { icon: "◈", text: "Photo of your whiteboard or notes" },
                  { icon: "◈", text: "Proposal or contract template" },
                  { icon: "◈", text: "SOW, process doc, or playbook" },
                  { icon: "◈", text: "Screenshot of your pricing or offer" },
                  { icon: "◈", text: "Any text doc about how you work" },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-2 text-xs text-slate-500">
                    <span className="text-[#22d3ee]/40 shrink-0 mt-px">{item.icon}</span>
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Capturing a YouTube link is a first-class capture too — show the four use cases. */}
        <YouTubeExplainerCard />

        {/* First-touch guide — what this connects to, and a sample absorbed item */}
        <TabGuide
          prompts={[
            "Drop a competitor's product launch video here — I'll log what they actually claimed",
            "Share a Russell Brunson or Hormozi clip — I'll add the techniques to your voice influences",
            "Send a customer testimonial video — I'll pull the quotes for your landing page",
            "Forward an industry update from a contractor channel — I'll summarize and roll it into your weekly brief",
          ]}
          worksWith={[
            {
              href: "/app/brain",
              label: "Brain",
              blurb: "Everything you capture gets absorbed into what your agent knows.",
            },
            {
              href: "/app/documents",
              label: "Documents",
              blurb: "The files you send in land here, viewable any time.",
            },
            {
              href: "/app/mission-control",
              label: "Mission Control",
              blurb: "Things shared from your phone show up to triage before they're filed.",
            },
          ]}
          exampleLabel="See what happens after you capture something"
          exampleNote="This is a sample. Drop a file or record a memo above to see your agent absorb it."
        >
          <div className="flex flex-col gap-2">
            <div className="rounded-xl border border-slate-800/60 bg-slate-950/50 px-4 py-3">
              <p className="text-[11px] font-mono text-slate-500">You shared</p>
              <p className="mt-0.5 text-sm font-medium text-slate-200">
                Voice memo — &ldquo;notes from the Harbor View deck walk&rdquo;
              </p>
            </div>
            <div className="rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/5 px-4 py-3">
              <p className="text-[11px] font-mono text-[#22d3ee]/70">Your agent absorbed it</p>
              <p className="mt-0.5 text-sm text-slate-300 leading-relaxed">
                Transcribed it, pulled the scope and the timeline you mentioned, and saved them to your
                brain under the Harbor View deck job.
              </p>
              <p className="mt-1 text-[10px] font-mono text-[#22d3ee]/50">
                → memory/job-harbor-view-deck.md
              </p>
            </div>
          </div>
        </TabGuide>
      </div>
    </div>
  );
}
