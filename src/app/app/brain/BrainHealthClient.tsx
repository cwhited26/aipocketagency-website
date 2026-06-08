"use client";

import { useState, useEffect } from "react";
import Mascot from "@/components/Mascot";
import { TabGuide } from "../_components/TabGuide";
import type { FreshnessArea, FreshnessResponse, FreshnessStatus } from "@/app/api/app/brain/freshness/route";
import type { BrainIndexResponse } from "@/app/api/app/brain/index/route";
import type { MemoryIndexRow, MemoryEntryType, RootFile } from "@/lib/pa-brain-index";
import { BRAIN_TASKS, TOTAL_BRAIN_POINTS } from "@/lib/brain-tasks";

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

function CheckCircleIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
        <circle cx="9" cy="9" r="8.25" fill="rgba(34,211,238,0.12)" stroke="#22d3ee" strokeWidth="1.5" />
        <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
      <circle cx="9" cy="9" r="8.25" stroke="#334155" strokeWidth="1.5" />
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

  // Avatar area links to its dedicated form, not capture
  const ctaHref =
    area.key === "avatar"
      ? "/app/brain/avatar"
      : `/app/capture?area=${area.key}&prompt=${encodeURIComponent(area.prompt)}`;

  const ctaLabel =
    area.key === "avatar"
      ? area.status === "empty" ? "Create avatar" : "Edit avatar"
      : area.status === "empty" ? "Feed this area" : "Feed it more";

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

      {/* CTA */}
      {(area.status === "empty" || area.status === "stale" || area.status === "warn") && (
        <a
          href={ctaHref}
          className="inline-flex items-center gap-1.5 self-start text-[11px] font-mono px-2.5 py-1 rounded-lg transition-all"
          style={{
            color: cfg.color,
            border: `1px solid ${cfg.border}`,
            background: cfg.bg,
          }}
        >
          <FeedIcon />
          {ctaLabel}
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

// ─── Brain task list ───────────────────────────────────────────────────────────

const TOTAL_POINTS = TOTAL_BRAIN_POINTS;

function ptsLabel(pts: number): string {
  const pct = pts / TOTAL_POINTS;
  if (pct >= 1) return "Brain complete";
  if (pct >= 0.75) return "Almost sharp";
  if (pct >= 0.5) return "Building up";
  if (pct >= 0.25) return "Getting there";
  return "Just started";
}

function BrainTaskList({ areas }: { areas: FreshnessArea[] }) {
  const filledKeys = new Set(areas.filter((a) => a.filled).map((a) => a.key));

  const tasksWithStatus = BRAIN_TASKS.map((t) => ({
    ...t,
    done: filledKeys.has(t.areaKey),
  }));

  const earnedPts = tasksWithStatus
    .filter((t) => t.done)
    .reduce((sum, t) => sum + t.points, 0);

  const pct = Math.round((earnedPts / TOTAL_POINTS) * 100);
  const label = ptsLabel(earnedPts);

  // Pending first, then done
  const pending = tasksWithStatus.filter((t) => !t.done);
  const done = tasksWithStatus.filter((t) => t.done);

  const ptsColor =
    pct >= 100 ? "#22d3ee" :
    pct >= 75 ? "#34d399" :
    pct >= 50 ? "#f59e0b" :
    "#94a3b8";

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
          Build your brain
        </span>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded"
            style={{ color: ptsColor, background: `${ptsColor}15`, border: `1px solid ${ptsColor}30` }}
          >
            {label}
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            <span style={{ color: ptsColor }} className="font-semibold">{earnedPts}</span>
            <span className="text-slate-600"> / {TOTAL_POINTS} pts</span>
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-[1000ms] ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${ptsColor}70, ${ptsColor})`,
          }}
        />
      </div>

      {/* Tasks */}
      <div className="flex flex-col gap-0.5 mt-0.5">
        {pending.map((task) => (
          <a
            key={task.id}
            href={task.link}
            className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-800/50 transition-colors group"
          >
            <CheckCircleIcon done={false} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-200 group-hover:text-slate-100 transition-colors leading-snug">
                  {task.label}
                </span>
                <span className="text-[10px] font-mono text-[#22d3ee]/60 shrink-0">
                  +{task.points} pts
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{task.desc}</p>
            </div>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0 mt-0.5 text-xs">→</span>
          </a>
        ))}

        {done.length > 0 && pending.length > 0 && (
          <div className="h-px bg-slate-800/60 mx-2 my-1" />
        )}

        {done.map((task) => (
          <div key={task.id} className="flex items-start gap-3 px-2 py-2.5 rounded-lg opacity-50">
            <CheckCircleIcon done={true} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-400 line-through leading-snug">
                  {task.label}
                </span>
                <span className="text-[10px] font-mono text-[#22d3ee]/50 shrink-0">
                  +{task.points} pts
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pct >= 100 && (
        <p className="text-[11px] font-mono text-[#22d3ee]/70 px-2">
          Your brain is complete. Every draft your agent writes is now conditioned on your full business context.
        </p>
      )}
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

// ─── Missing root files banner ─────────────────────────────────────────────────

function MissingRootFilesBanner({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  const list = missing.join(", ");
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 flex gap-3">
      <span className="text-amber-400 shrink-0 mt-0.5">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
          <path d="M7 4v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="7" cy="9.5" r="0.7" fill="currentColor" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-300">
          Missing root files: {list}
        </p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
          These are the first files your agents read. Bootstrap them from the template in{" "}
          <a href="/app/settings" className="text-[#22d3ee]/70 hover:text-[#22d3ee] transition-colors underline">
            Settings → Brain repo
          </a>
          .
        </p>
      </div>
    </div>
  );
}

// ─── Memory index section ───────────────────────────────────────────────────────

const TYPE_ORDER: MemoryEntryType[] = ["user", "feedback", "project", "reference", "unknown"];

const TYPE_LABELS: Record<MemoryEntryType, string> = {
  user: "About you",
  feedback: "Working style",
  project: "Projects & context",
  reference: "References",
  unknown: "Other entries",
};

function MemoryIndexSection({
  entries,
  lastIndexed,
}: {
  entries: MemoryIndexRow[];
  lastIndexed: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  const grouped = new Map<MemoryEntryType, MemoryIndexRow[]>();
  for (const e of entries) {
    const t = e.type as MemoryEntryType;
    if (!grouped.has(t)) grouped.set(t, []);
    grouped.get(t)!.push(e);
  }

  const orderedTypes = TYPE_ORDER.filter((t) => grouped.has(t));
  const PREVIEW_COUNT = 5;
  const allEntries = entries;
  const visible = expanded ? allEntries : allEntries.slice(0, PREVIEW_COUNT);
  const visibleGrouped = new Map<MemoryEntryType, MemoryIndexRow[]>();
  for (const e of visible) {
    const t = e.type as MemoryEntryType;
    if (!visibleGrouped.has(t)) visibleGrouped.set(t, []);
    visibleGrouped.get(t)!.push(e);
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-mono text-slate-300 tracking-[0.14em] uppercase font-semibold">
            Memory index
          </span>
          <span className="ml-2 text-[10px] font-mono text-slate-600">
            {entries.length} files indexed
          </span>
        </div>
        {lastIndexed && (
          <span className="text-[10px] font-mono text-slate-600 shrink-0">
            {relativeTime(lastIndexed)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {orderedTypes
          .filter((t) => visibleGrouped.has(t))
          .map((t) => (
            <div key={t}>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.16em] mb-1.5">
                {TYPE_LABELS[t]}
              </p>
              <div className="flex flex-col gap-0.5">
                {(visibleGrouped.get(t) ?? []).map((entry) => (
                  <a
                    key={entry.id}
                    href={`/app/documents?path=${encodeURIComponent(entry.path)}`}
                    className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800/50 transition-colors group"
                  >
                    <span className="text-slate-600 group-hover:text-slate-500 shrink-0 mt-0.5 text-[10px] font-mono">
                      ›
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-slate-300 group-hover:text-slate-100 transition-colors leading-snug block truncate">
                        {entry.name ?? entry.path.split("/").pop()}
                      </span>
                      {entry.description && (
                        <span className="text-[10px] text-slate-600 leading-snug block truncate mt-0.5">
                          {entry.description}
                        </span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
      </div>

      {allEntries.length > PREVIEW_COUNT && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors self-start mt-1"
        >
          {expanded ? "Show less ↑" : `Show all ${allEntries.length} entries ↓`}
        </button>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function BrainHealthClient({
  brainRepo,
  hasGithubToken,
  lastIndexed: initialLastIndexed,
}: {
  brainRepo: string | null;
  hasGithubToken: boolean;
  lastIndexed: string | null;
}) {
  const [data, setData] = useState<FreshnessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [indexData, setIndexData] = useState<BrainIndexResponse | null>(null);
  const [lastIndexed, setLastIndexed] = useState<string | null>(initialLastIndexed);

  useEffect(() => {
    if (!brainRepo) {
      setLoading(false);
      return;
    }

    const freshnessPromise = fetch("/api/app/brain/freshness")
      .then((r) => (r.ok ? (r.json() as Promise<FreshnessResponse>) : Promise.reject(new Error(`${r.status}`))))
      .then((d) => { setData(d); })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to load";
        setError(msg);
      });

    const indexPromise = fetch("/api/app/brain/index")
      .then((r) => (r.ok ? (r.json() as Promise<BrainIndexResponse>) : Promise.reject()))
      .then((d) => {
        setIndexData(d);
        if (d.lastIndexed) setLastIndexed(d.lastIndexed);
      })
      .catch(() => { /* index is optional — don't block page render */ });

    void Promise.all([freshnessPromise, indexPromise]).then(() => setLoading(false));
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

        {/* Header — mobile-first: stack on mobile, side-by-side on sm+ */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Mascot state="brain" size={52} className="shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-100">Brain</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                How well your agent knows your business
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {brainRepo && (
              <a
                href="/app/brain/digest"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2.5 text-xs font-mono text-slate-300 hover:text-slate-100 hover:bg-slate-700/60 transition-all min-h-[40px] whitespace-nowrap"
              >
                <SparkleIcon />
                Weekly read
              </a>
            )}
            <a
              href="/app/onboarding?update=1"
              className="inline-flex items-center rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2.5 text-xs font-mono text-slate-300 hover:text-slate-100 hover:bg-slate-700/60 transition-all min-h-[40px] whitespace-nowrap"
            >
              Setup wizard
            </a>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          Your brain is everything your agent knows about your business — your services and
          pricing, how you write, who your customers are, the decisions you&apos;ve made, the way
          you like to follow up. It reads all of it before every reply, so the more it holds, the
          more the drafts sound like you and the answers fit your situation. Ask it what it knows
          about the Stoll deal and it tells you. Tell it your follow-up cadence is 7, 14, then 30
          days and it remembers for good. This page shows how complete your brain is and what to
          fill in next.
        </p>

        {/* Brain primitives — quick access to North Star, Specs, and Memory tiers */}
        {brainRepo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <a
              href="/app/brain/north-star"
              className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3.5 py-3 hover:bg-slate-800/60 hover:border-slate-600/60 transition-all group"
            >
              <span className="text-sm font-semibold text-slate-200 group-hover:text-slate-100">North Star</span>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Mission, goals & beliefs</p>
            </a>
            <a
              href="/app/brain/specs"
              className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3.5 py-3 hover:bg-slate-800/60 hover:border-slate-600/60 transition-all group"
            >
              <span className="text-sm font-semibold text-slate-200 group-hover:text-slate-100">Specs</span>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Structured plans for your work</p>
            </a>
            <a
              href="/app/brain/memory"
              className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3.5 py-3 hover:bg-slate-800/60 hover:border-slate-600/60 transition-all group"
            >
              <span className="text-sm font-semibold text-slate-200 group-hover:text-slate-100">Memory</span>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Active work · Knowledge · Patterns</p>
            </a>
          </div>
        )}

        {/* Body */}
        {!brainRepo ? (
          <NoBrainState hasGithubToken={hasGithubToken} />
        ) : loading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Mascot state="working" size={88} />
            <p className="text-[12px] font-mono text-slate-500">reading your brain…</p>
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
            {/* Missing root files banner — only shown when index has run */}
            {indexData && (() => {
              const missing = (indexData.rootFiles as RootFile[])
                .filter((f) => !f.present)
                .map((f) => f.name);
              return <MissingRootFilesBanner missing={missing} />;
            })()}

            <ScoreBar filled={data.filled} total={data.total} pct={data.pct} />

            <BrainTaskList areas={data.areas} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sortedAreas.map((area) => (
                <AreaCard key={area.key} area={area} />
              ))}
            </div>

            {/* Memory index — existing files in the connected brain */}
            {indexData && (
              <MemoryIndexSection
                entries={indexData.entries}
                lastIndexed={lastIndexed}
              />
            )}

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

        {/* First-touch guide — what to ask, what this connects to, and sample memory */}
        <TabGuide
          promptsHeading="Try one of these"
          prompts={[
            "What do you know about the Stoll deal?",
            "Add to memory: my follow-up cadence is 7, 14, then 30 days",
            "What's my pricing for a single-page site?",
          ]}
          worksWith={[
            {
              href: "/app/documents",
              label: "Documents",
              blurb: "The actual files behind your brain — proposals, PDFs, notes you've uploaded.",
            },
            {
              href: "/app/capture",
              label: "Capture",
              blurb: "The fastest way to add to your brain — a voice memo, a photo, a shared doc.",
            },
            {
              href: "/app/ask",
              label: "Agent",
              blurb: "Reads from here on every reply, and saves new facts back when you tell it to.",
            },
          ]}
          exampleLabel="See an example of what your agent remembers"
          exampleNote="This is a sample. Your real memory fills in as you talk to your agent and feed your brain."
        >
          <ul className="flex flex-col gap-2">
            {[
              { k: "Deal · Stoll", v: "Roof + gutter scope quoted Jun 2. Decision expected this week. Prefers email over calls." },
              { k: "How you follow up", v: "Cadence is 7, 14, then 30 days. Short, no fluff, one clear ask per email." },
              { k: "Pricing", v: "Single-page site: $1,500 flat. Multi-step builds quoted per scope." },
            ].map((m) => (
              <li
                key={m.k}
                className="rounded-xl border border-slate-800/60 bg-slate-950/50 px-4 py-3"
              >
                <p className="text-[10px] font-mono text-[#22d3ee]/60 uppercase tracking-[0.16em]">
                  {m.k}
                </p>
                <p className="mt-1 text-sm text-slate-300 leading-relaxed">{m.v}</p>
              </li>
            ))}
          </ul>
        </TabGuide>
      </div>
    </div>
  );
}
