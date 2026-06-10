"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { UsageSnapshot, UsageMetricRow } from "@/lib/usage/snapshot";

// UsageTab — the customer-facing read-only Usage dashboard (Usage Surface v1, PA-USAGE-4). It answers
// "how much of my plan have I used this month?" — never "what did it cost?". In the default platform-
// managed flow the owner pays a flat subscription and we cover the API spend, so dollars would only
// mislead; they see tier-denominated progress bars instead. Owners on their OWN API key also get a
// "Real cost" panel (PA-USAGE-7) — their money, their bill. Rides the same 8s auto-refresh-on-focus
// pattern Operations uses (paused on blur via the Page Visibility API).

const TIER_HREF = "/app/settings/tier";

// Cost-event feature slugs → customer-facing names, for the BYO real-cost breakdown.
const COST_FEATURE_LABELS: Record<string, string> = {
  podcast: "Podcast transcription",
  youtube: "YouTube",
  lead_scout: "Lead Scout",
  roundtable: "Decision Roundtable",
  chat: "Chat",
  email_drafter: "Email Drafter",
  build_tools: "Build tools",
  landing_page_builder: "Landing Page Builder",
  capture_triage: "Capture triage",
  follow_up_sweeps: "Follow-Up Sweeps",
  other: "Other",
};

function money(microCents: number): string {
  return `$${(microCents / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const numberFmt = new Intl.NumberFormat("en-US");

/** A used/cap amount in its unit, read for an owner ("132 leads" / "1.4h" / "12 min"). */
function amount(value: number, unit: UsageMetricRow["unit"]): string {
  switch (unit) {
    case "hours":
      return `${value % 1 === 0 ? value : value.toFixed(1)}h`;
    case "minutes":
      return `${numberFmt.format(value)} min`;
    default:
      return `${numberFmt.format(value)} ${value === 1 ? singular(unit) : unit}`;
  }
}

function singular(unit: UsageMetricRow["unit"]): string {
  switch (unit) {
    case "leads":
      return "lead";
    case "videos":
      return "video";
    case "connections":
      return "connection";
    case "personas":
      return "persona";
    case "runs":
      return "run";
    default:
      return unit;
  }
}

function MetricCard({
  row,
  nextTierLabel,
}: {
  row: UsageMetricRow;
  nextTierLabel: string | null;
}) {
  const featureOff = !row.informational && row.cap === 0;
  const unlimited = !row.informational && row.cap === null;
  const pct = Math.min(100, Math.max(0, row.pct));
  const nearLimit = !row.informational && row.cap !== null && row.cap > 0 && row.pct >= 80;
  const atLimit = !row.informational && row.cap !== null && row.cap > 0 && row.pct >= 100;

  const barColor = atLimit ? "bg-red-500" : nearLimit ? "bg-amber-400" : "bg-[#22d3ee]/70";

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-5 py-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-slate-200">{row.label}</span>
        {featureOff ? (
          <span className="text-[11px] font-mono text-slate-500">
            {nextTierLabel ? `${nextTierLabel} plan` : "Not on your plan"}
          </span>
        ) : row.informational ? (
          <span className="text-[12px] font-mono text-slate-400 tabular-nums">
            {amount(row.used, row.unit)}
          </span>
        ) : (
          <span className="text-[12px] font-mono text-slate-400 tabular-nums">
            {amount(row.used, row.unit)}
            {unlimited ? "" : ` / ${amount(row.cap ?? 0, row.unit)}`}
          </span>
        )}
      </div>

      {/* Progress bar only for capped metrics that are actually on the plan. */}
      {!row.informational && !featureOff && !unlimited && (
        <div className="mt-2.5 h-1.5 rounded-full bg-slate-800/70 overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      )}

      <p className="mt-2 text-[12px] text-slate-500 leading-relaxed">
        {featureOff
          ? `${row.blurb} ${nextTierLabel ? `Upgrade to ${nextTierLabel} to turn this on.` : ""}`.trim()
          : unlimited
            ? `${row.blurb} No limit on your plan.`
            : row.informational
              ? row.note ?? row.blurb
              : row.blurb}
      </p>

      {row.subNote && !featureOff && (
        <p className="mt-1 text-[11px] font-mono text-slate-600">{row.subNote}</p>
      )}

      {(nearLimit || featureOff) && nextTierLabel && (
        <Link
          href={TIER_HREF}
          className="mt-3 inline-block text-[12px] font-mono text-[#22d3ee]/80 hover:text-[#22d3ee] transition-colors"
        >
          {atLimit ? `You're out — upgrade to ${nextTierLabel} →` : `Upgrade to ${nextTierLabel} →`}
        </Link>
      )}
    </div>
  );
}

function ByoCostPanel({ snapshot }: { snapshot: UsageSnapshot }) {
  const cost = snapshot.byo.cost;
  if (!cost) return null;
  const maxV = Math.max(1, ...cost.byFeature.map((f) => f.microCents));
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] px-5 py-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-emerald-200">Real cost (your API key)</span>
        <span className="text-[12px] font-mono text-emerald-300 tabular-nums">
          {money(cost.totalMicroCents)} this month
        </span>
      </div>
      <p className="mt-1.5 text-[12px] text-slate-400 leading-relaxed">
        You&apos;re on your own model provider, so this is what your key has actually been billed this
        month — straight from each call&apos;s usage.
      </p>
      {cost.byFeature.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {cost.byFeature.map((f) => (
            <div key={f.featureSlug}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-slate-300 truncate">
                  {COST_FEATURE_LABELS[f.featureSlug] ?? f.featureSlug}
                </span>
                <span className="text-[11px] font-mono text-slate-500 shrink-0 tabular-nums">
                  {money(f.microCents)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-800/70 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400/70"
                  style={{ width: `${Math.max(2, (f.microCents / maxV) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function resetLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

export default function UsageTab() {
  const [snapshot, setSnapshot] = useState<UsageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/app/mission-control/usage", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load usage (${res.status})`);
      const data = (await res.json()) as UsageSnapshot;
      setSnapshot(data);
      setError(null);
    } catch (e) {
      if (firstLoad.current) setError(e instanceof Error ? e.message : "Failed to load usage");
    } finally {
      if (firstLoad.current) {
        setLoading(false);
        firstLoad.current = false;
      }
    }
  }, []);

  // Same auto-refresh-on-focus pattern as Operations: poll every 8s while visible, pause on blur.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const start = () => {
      if (timer === null) timer = setInterval(() => void load(), 8000);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
        start();
      } else {
        stop();
      }
    };
    void load();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 text-center">
        <p className="text-[12px] font-mono text-slate-500">checking your plan usage…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-6 py-6">
        <p className="text-red-400 text-sm font-mono">{error}</p>
      </div>
    );
  }
  if (!snapshot) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[13px] text-slate-300">
            You&apos;re on the <span className="font-semibold text-slate-100">{snapshot.tierLabel}</span> plan.
          </p>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Monthly counts reset {resetLabel(snapshot.periodResetAt)}.
          </p>
        </div>
        <Link
          href={TIER_HREF}
          className="text-[12px] font-mono text-[#22d3ee]/80 hover:text-[#22d3ee] transition-colors"
        >
          Plan &amp; limits →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {snapshot.metrics.map((row) => (
          <MetricCard key={row.key} row={row} nextTierLabel={snapshot.nextTierLabel} />
        ))}
      </div>

      {snapshot.byo.configured && <ByoCostPanel snapshot={snapshot} />}
    </div>
  );
}
