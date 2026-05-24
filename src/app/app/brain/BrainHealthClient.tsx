"use client";

import { useState, useEffect } from "react";
import type { FreshnessArea, FreshnessResponse, FreshnessStatus } from "@/app/api/app/brain/freshness/route";

// ─── Icons ─────────────────────────────────────────────────────────────────────

function FeedIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v5M3.5 3.5L6 1l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 8v2h9V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1l1 3.5L11 5.5l-3.5 1L6.5 10l-1-3.5L2 5.5l3.5-1L6.5 1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Status helpers ────────────────────────────────────────────────────────────

function statusConfig(status: FreshnessStatus): {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
} {
  switch (status) {
    case "fresh":
      return {
        label: "Up to date",
        color: "#22d3ee",
        bg: "rgba(34,211,238,0.08)",
        border: "rgba(34,211,238,0.25)",
        dot: "#22d3ee",
      };
    case "warn":
      return {
        label: "Getting stale",
        color: "#f59e0b",
        bg: "rgba(245,158,11,0.07)",
        border: "rgba(245,158,11,0.25)",
        dot: "#f59e0b",
      };
    case "stale":
      return {
        label: "Needs attention",
        color: "#f87171",
        bg: "rgba(248,113,113,0.07)",
        border: "rgba(248,113,113,0.25)",
        dot: "#f87171",
      };
    case "empty":
    default:
      return {
        label: "Not filled",
        color: "#64748b",
        bg: "rgba(30,41,59,0.3)",
        border: "rgba(51,65,85,0.5)",
        dot: "#475569",
      };
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Area Card ─────────────────────────────────────────────────────────────────

function AreaCard({ area }: { area: FreshnessArea }) {
  const cfg = statusConfig(area.status);

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2.5"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5"
            style={{ background: cfg.dot }}
          />
          <span className="text-sm font-semibold text-slate-100 leading-snug">
            {area.label}
          </span>
        </div>
        <span
          className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded"
          style={{ color: cfg.color, background: `${cfg.bg}`, border: `1px solid ${cfg.border}` }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Desc */}
      <p className="text-xs text-slate-400 leading-relaxed">{area.desc}</p>

      {/* Meta */}
      {area.filled && area.lastModified && (
        <p className="text-[10px] font-mono text-slate-600">
          Last updated {relativeTime(area.lastModified)}
          {area.daysSince !== null && area.daysSince > 30 && (
            <span className="text-red-400/70 ml-1">— overdue for a refresh</span>
          )}
          {area.daysSince !== null && area.daysSince > 14 && area.daysSince <= 30 && (
            <span className="text-amber-400/70 ml-1">— worth reviewing</span>
          )}
        </p>
      )}

      {/* Feed CTA */}
      {(area.status === "empty" || area.status === "stale" || area.status === "warn") && (
        <a
          href={`/app/capture?area=${area.key}&prompt=${encodeURIComponent(area.prompt)}`}
          className="inline-flex items-center gap-1.5 self-start text-[11px] font-mono px-2.5 py-1 rounded-lg transition-all"
          style={{
            color: cfg.color,
            border: `1px solid ${cfg.border}`,
            background: cfg.bg,
          }}
        >
          <FeedIcon />
          Feed {area.status === "empty" ? "this area" : "it more"}
        </a>
      )}
    </div>
  );
}

// ─── Overall score bar ─────────────────────────────────────────────────────────

function ScoreBar({ filled, total, pct }: { filled: number; total: number; pct: number }) {
  const health =
    pct >= 100 ? "full" :
    pct >= 67 ? "healthy" :
    pct >= 33 ? "building" :
    "thin";

  const healthColor =
    health === "full" ? "#22d3ee" :
    health === "healthy" ? "#34d399" :
    health === "building" ? "#f59e0b" :
    "#f87171";

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
          Brain strength
        </span>
        <span
          className="text-[11px] font-mono px-2 py-0.5 rounded capitalize"
          style={{ color: healthColor, background: `${healthColor}15`, border: `1px solid ${healthColor}30` }}
        >
          {health}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-[1000ms] ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${healthColor}80, ${healthColor})`,
            boxShadow: pct > 0 ? `0 0 6px ${healthColor}40` : "none",
          }}
        />
      </div>

      <p className="text-xs text-slate-400">
        <span className="text-slate-200 font-semibold">{filled}</span> of {total} areas filled —{" "}
        {health === "full"
          ? "your agent has everything it needs."
          : health === "healthy"
          ? "strong. Keep feeding the thin spots."
          : health === "building"
          ? "getting there. The more you add, the sharper the agent gets."
          : "thin. The agent works best with more context about your business."}
      </p>
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────────

function NoBrainState({ hasGithubToken }: { hasGithubToken: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-5 py-16 px-6">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ border: "1px solid rgba(34,211,238,0.2)", background: "rgba(34,211,238,0.05)" }}
      >
        <span className="text-[#22d3ee]/50">
          <SparkleIcon />
        </span>
      </div>
      <div className="space-y-2 max-w-xs">
        <p className="text-base font-semibold text-slate-200">No brain connected yet</p>
        {!hasGithubToken ? (
          <p className="text-sm text-slate-400 leading-relaxed">
            Connect GitHub so your agent has a place to learn and remember.{" "}
            <a href="/api/app/auth/github?next=/app/brain" className="text-[#22d3ee] hover:underline">
              Connect GitHub →
            </a>
          </p>
        ) : (
          <p className="text-sm text-slate-400 leading-relaxed">
            Set up your brain to give the agent context about your business.{" "}
            <a href="/app/onboarding" className="text-[#22d3ee] hover:underline">
              Set up brain →
            </a>
          </p>
        )}
        <p className="text-xs text-slate-500 leading-relaxed pt-1">
          Once connected, this view shows which parts of your brain are strong
          and which need feeding — so your agent gives better answers.
        </p>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function BrainHealthClient({
  brainRepo,
  hasGithubToken,
}: {
  brainRepo: string | null;
  hasGithubToken: boolean;
}) {
  const [data, setData] = useState<FreshnessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brainRepo) {
      setLoading(false);
      return;
    }
    fetch("/api/app/brain/freshness")
      .then((r) => (r.ok ? (r.json() as Promise<FreshnessResponse>) : Promise.reject(new Error(`${r.status}`))))
      .then((d) => { setData(d); setLoading(false); })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to load";
        setError(msg);
        setLoading(false);
      });
  }, [brainRepo]);

  // Sort areas: stale first, then warn, then empty, then fresh
  const sortedAreas = data
    ? [...data.areas].sort((a, b) => {
        const order: Record<FreshnessStatus, number> = { stale: 0, warn: 1, empty: 2, fresh: 3 };
        return order[a.status] - order[b.status];
      })
    : [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-7 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Brain</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              How well your agent knows your business
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {brainRepo && (
              <a
                href="/app/brain/digest"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-xs font-mono text-slate-300 hover:text-slate-100 hover:bg-slate-700/60 transition-all"
              >
                <SparkleIcon />
                Weekly read
              </a>
            )}
            <a
              href="/app/onboarding?update=1"
              className="inline-flex items-center rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-xs font-mono text-slate-300 hover:text-slate-100 hover:bg-slate-700/60 transition-all"
            >
              Setup wizard
            </a>
          </div>
        </div>

        {/* Body */}
        {!brainRepo ? (
          <NoBrainState hasGithubToken={hasGithubToken} />
        ) : loading ? (
          <div className="flex flex-col gap-4">
            <div className="h-20 rounded-xl bg-slate-900/60 border border-slate-700/60 animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-slate-900/60 border border-slate-700/60 animate-pulse" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-6 text-center">
            <p className="text-sm text-slate-400">
              Could not load brain health.{" "}
              <button
                onClick={() => { setError(null); setLoading(true); fetch("/api/app/brain/freshness").then((r) => r.ok ? r.json() as Promise<FreshnessResponse> : Promise.reject()).then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false)); }}
                className="text-[#22d3ee] hover:underline"
              >
                Retry
              </button>
            </p>
          </div>
        ) : data ? (
          <div className="flex flex-col gap-4">
            <ScoreBar filled={data.filled} total={data.total} pct={data.pct} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sortedAreas.map((area) => (
                <AreaCard key={area.key} area={area} />
              ))}
            </div>

            {/* Footer tip */}
            <div className="rounded-xl border border-slate-800/40 bg-slate-900/20 px-4 py-3">
              <p className="text-[11px] font-mono text-slate-600 leading-relaxed">
                The more you feed your brain, the sharper your agent&apos;s answers get.{" "}
                <a href="/app/capture" className="text-[#22d3ee]/60 hover:text-[#22d3ee] transition-colors">
                  Upload a file →
                </a>
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
