"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { priceReference } from "@/lib/cost/prices";
import type {
  BreakdownRow,
  CostPeriod,
  CostRollup,
  LineBucket,
} from "@/lib/mission-control/cost-rollup";

// CostTab — the read-only spend dashboard (Cost Observability SPEC §5.5, Phase 2). Three tiles, a
// spend-over-time line (Day/Week/Month, default Month), and a three-up breakdown that LEADS with
// feature area (PA-COST-5), then model, then backend. No budgets, no gate — that's Phase 3 + 4. It
// fetches /api/app/mission-control/cost and rides the same auto-refresh-on-focus pattern Operations
// uses: 8s while the tab is focused, paused on blur via the Page Visibility API.

// 1 USD = 1,000,000 micro-cents (PA-COST-9). Store stays in micro-cents; we round to dollars only here.
const MICRO_PER_USD = 1_000_000;
const tokenFmt = new Intl.NumberFormat("en-US");

/** Whole-cent dollar display for the tiles + bars ($12.34). */
function money(microCents: number): string {
  return `$${(microCents / MICRO_PER_USD).toFixed(2)}`;
}

/** Sub-cent precision for the hover tooltip ($0.0042) — the whole point of the ledger (SPEC §5.5). */
function moneyPrecise(microCents: number): string {
  return `$${(microCents / MICRO_PER_USD).toFixed(4)}`;
}

const PERIODS: { key: CostPeriod; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

// ─── Tiles ──────────────────────────────────────────────────────────────────────

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 px-5 py-5">
      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-slate-100">{value}</div>
      <div className="mt-1 text-[11px] text-slate-600">{sub}</div>
    </div>
  );
}

function Tiles({ rollup }: { rollup: CostRollup }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Tile
        label="Total spend this period"
        value={money(rollup.tiles.totalSpendMicroCents)}
        sub="What the agents cost you so far"
      />
      <Tile
        label="Total tokens"
        value={tokenFmt.format(rollup.tiles.totalTokens)}
        sub="Read + written across every model"
      />
      <Tile
        label="Turns recorded"
        value={tokenFmt.format(rollup.tiles.turnsRecorded)}
        sub="Chat turns + sub-agent runs"
      />
    </div>
  );
}

// ─── Spend-over-time chart (hand-rolled SVG, matching the Brain Map precedent) ─────
//
// Desktop renders the full chart — y-axis dollar gridlines, scaled x-axis ticks, an area+line, and a
// hover layer whose tooltip shows sub-cent precision ($0.0042) at the nearest bucket. Mobile renders a
// sparkline (no axes, no ticks, no legend) under 640px. Both read the same buckets.

const VIEW_W = 720;
const VIEW_H = 200;
const PAD = { top: 14, right: 14, bottom: 26, left: 48 };

function scaleX(i: number, n: number): number {
  const inner = VIEW_W - PAD.left - PAD.right;
  if (n <= 1) return PAD.left + inner / 2;
  return PAD.left + (i / (n - 1)) * inner;
}

function scaleY(v: number, maxV: number): number {
  const inner = VIEW_H - PAD.top - PAD.bottom;
  return PAD.top + (1 - v / maxV) * inner;
}

// Even ~6 ticks across the buckets without crowding the axis on a 30-day month.
function tickIndices(n: number, target = 6): number[] {
  if (n <= target) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (target - 1);
  return Array.from({ length: target }, (_, i) => Math.round(i * step));
}

function SpendChart({ line }: { line: LineBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const n = line.length;
  const maxV = Math.max(1, ...line.map((b) => b.spendMicroCents));
  const linePts = line.map((b, i) => `${scaleX(i, n)},${scaleY(b.spendMicroCents, maxV)}`).join(" ");
  const baselineY = scaleY(0, maxV);
  const areaPath =
    n > 0
      ? `M ${scaleX(0, n)},${baselineY} L ${linePts.replace(/ /g, " L ")} L ${scaleX(n - 1, n)},${baselineY} Z`
      : "";

  // Three horizontal gridlines at 0 / mid / max, labelled in dollars.
  const gridVals = [0, maxV / 2, maxV];

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = wrapRef.current;
      if (!el || n === 0) return;
      const rect = el.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      setHover(Math.round(frac * (n - 1)));
    },
    [n],
  );

  const hovered = hover !== null ? line[hover] : null;

  return (
    <div>
      {/* Desktop: full chart with hover */}
      <div
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        className="relative hidden sm:block"
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto" role="img" aria-label="Spend over time">
          {gridVals.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={VIEW_W - PAD.right}
                y1={scaleY(v, maxV)}
                y2={scaleY(v, maxV)}
                stroke="#1e293b"
                strokeWidth={1}
              />
              <text x={PAD.left - 6} y={scaleY(v, maxV) + 3} textAnchor="end" className="fill-slate-600 text-[9px] font-mono">
                {money(v)}
              </text>
            </g>
          ))}

          {areaPath && <path d={areaPath} fill="#22d3ee" fillOpacity={0.08} />}
          {n > 1 && <polyline points={linePts} fill="none" stroke="#22d3ee" strokeWidth={2} strokeLinejoin="round" />}
          {line.map((b, i) => (
            <circle key={i} cx={scaleX(i, n)} cy={scaleY(b.spendMicroCents, maxV)} r={n > 40 ? 0 : 2} fill="#22d3ee" />
          ))}

          {tickIndices(n).map((i) => (
            <text
              key={i}
              x={scaleX(i, n)}
              y={VIEW_H - 8}
              textAnchor="middle"
              className="fill-slate-600 text-[9px] font-mono"
            >
              {line[i]?.label ?? ""}
            </text>
          ))}

          {hover !== null && hovered && (
            <g>
              <line
                x1={scaleX(hover, n)}
                x2={scaleX(hover, n)}
                y1={PAD.top}
                y2={VIEW_H - PAD.bottom}
                stroke="#22d3ee"
                strokeOpacity={0.4}
                strokeWidth={1}
              />
              <circle cx={scaleX(hover, n)} cy={scaleY(hovered.spendMicroCents, maxV)} r={3.5} fill="#22d3ee" />
            </g>
          )}
        </svg>

        {hover !== null && hovered && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-slate-700/70 bg-slate-950/95 px-2.5 py-1.5 text-center shadow-lg"
            style={{ left: `${(scaleX(hover, n) / VIEW_W) * 100}%`, top: "8%" }}
          >
            <div className="text-[10px] font-mono text-slate-400">{hovered.label}</div>
            <div className="text-[12px] font-semibold tabular-nums text-[#22d3ee]">
              {moneyPrecise(hovered.spendMicroCents)}
            </div>
          </div>
        )}
      </div>

      {/* Mobile: sparkline only */}
      <div className="sm:hidden">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto" role="img" aria-label="Spend over time">
          {areaPath && <path d={areaPath} fill="#22d3ee" fillOpacity={0.08} />}
          {n > 1 && <polyline points={linePts} fill="none" stroke="#22d3ee" strokeWidth={2.5} strokeLinejoin="round" />}
        </svg>
      </div>
    </div>
  );
}

// ─── Breakdown card ───────────────────────────────────────────────────────────────

function BreakdownCard({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const maxV = Math.max(1, ...rows.map((r) => r.spendMicroCents));
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-5 py-5">
      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500 mb-3">{title}</div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-slate-600">Nothing yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-slate-300 truncate">{r.label}</span>
                <span className="text-[11px] font-mono text-slate-500 shrink-0 tabular-nums">
                  {money(r.spendMicroCents)} · {r.events} {r.events === 1 ? "event" : "events"}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-800/70 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#22d3ee]/70"
                  style={{ width: `${Math.max(2, (r.spendMicroCents / maxV) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pricing reference (auto-rendered from lib/cost/prices — one source of truth) ──

function PricingReference() {
  const [open, setOpen] = useState(false);
  const entries = priceReference();
  const anyEstimated = entries.some((e) => e.estimated);
  return (
    <div className="rounded-2xl border border-slate-800/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[44px] flex items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm text-slate-300">How we price this</span>
        <span className="text-xs font-mono text-slate-500">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1">
          <p className="text-[12px] text-slate-500 leading-relaxed mb-4">
            These are the exact rates the spend numbers above are figured from. Check any figure against
            the provider&apos;s own invoice — the ledger writes the real cost from each call&apos;s usage,
            and these rates are what turn that usage into dollars.
          </p>
          <div className="flex flex-col gap-4">
            {entries.map((entry) => (
              <div key={entry.backend} className="border-t border-slate-800/50 pt-3 first:border-0 first:pt-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium text-slate-300">{entry.label}</span>
                  <span className="text-[10px] font-mono text-slate-600">
                    {entry.unit}
                    {entry.estimated ? " · estimate" : ""}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-col gap-1">
                  {entry.lines.map((l) => (
                    <div key={l.name} className="flex items-baseline justify-between gap-3 text-[12px]">
                      <span className="font-mono text-slate-500">{l.name}</span>
                      <span className="font-mono text-slate-400 tabular-nums">{l.rate}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-slate-600 leading-relaxed">
            {anyEstimated && "Rates marked “estimate” are kept by hand and reconciled against the real invoice. "}
            Text messages and email send (Twilio, Resend) pass through at the provider&apos;s own
            per-message cost and aren&apos;t priced from this table.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tab ────────────────────────────────────────────────────────────────────────

export default function CostTab() {
  const [period, setPeriod] = useState<CostPeriod>("month"); // default Month (PA-COST-6)
  const [rollup, setRollup] = useState<CostRollup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async (p: CostPeriod) => {
    try {
      const res = await fetch(`/api/app/mission-control/cost?period=${p}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load cost (${res.status})`);
      const data = (await res.json()) as CostRollup;
      setRollup(data);
      setError(null);
    } catch (e) {
      if (firstLoad.current) setError(e instanceof Error ? e.message : "Failed to load cost");
    } finally {
      if (firstLoad.current) {
        setLoading(false);
        firstLoad.current = false;
      }
    }
  }, []);

  // Same auto-refresh-on-focus pattern as Operations: poll every 8s while visible, pause on blur,
  // refresh immediately on return (Page Visibility API). Re-subscribes when the period changes.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const start = () => {
      if (timer === null) timer = setInterval(() => void load(period), 8000);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load(period);
        start();
      } else {
        stop();
      }
    };
    void load(period);
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [load, period]);

  return (
    <div className="flex flex-col gap-6">
      {/* Period toggle */}
      <div className="flex items-center gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={[
              "min-h-[44px] px-4 rounded-xl text-sm font-medium transition-colors",
              period === p.key
                ? "bg-[#22d3ee] text-[#031820]"
                : "border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-500",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 text-center">
          <p className="text-[12px] font-mono text-slate-500">tallying your spend…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-6 py-6">
          <p className="text-red-400 text-sm font-mono">{error}</p>
        </div>
      ) : rollup ? (
        <>
          <Tiles rollup={rollup} />

          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-4 sm:px-5 py-5">
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500 mb-4">
              Spend over time
            </div>
            <SpendChart line={rollup.line} />

            {rollup.empty && (
              <div className="mt-4 rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-4">
                <p className="text-[13px] text-slate-400 leading-relaxed">
                  Nothing&apos;s landed here yet. When Pocket Agent runs a sub-agent, transcribes a
                  podcast, or scrapes a lead, the spend lands here — you&apos;ll see what each agent
                  costs and where it came from.
                </p>
              </div>
            )}
          </div>

          {/* Breakdown row — feature area leads (PA-COST-5), then model, then backend */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <BreakdownCard title="By feature area" rows={rollup.byFeature} />
            <BreakdownCard title="By model" rows={rollup.byModel} />
            <BreakdownCard title="By backend" rows={rollup.byBackend} />
          </div>

          <PricingReference />
        </>
      ) : null}
    </div>
  );
}
