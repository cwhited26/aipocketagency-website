"use client";

import { useRef, useState } from "react";
import type { BudgetSummary } from "@/lib/cost/budget";

function dollarsFromCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function dollarsFromMicro(microCents: number): string {
  return `$${(microCents / 1_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function resetDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function BudgetClient({ initial }: { initial: BudgetSummary }) {
  const [summary, setSummary] = useState<BudgetSummary>(initial);
  const [editing, setEditing] = useState(false);
  const [draftDollars, setDraftDollars] = useState(String(Math.round(initial.budgetCents / 100)));
  const [busy, setBusy] = useState<null | "save" | "reset" | "keep_going" | "pause">(null);
  const [error, setError] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const pct = Math.round(summary.pct);
  const overBudget = summary.gate.status === "block_100";
  const warning = summary.gate.status === "warn_80";
  const paused = summary.decision === "pause";

  const barColor = overBudget
    ? "bg-red-500"
    : warning
      ? "bg-amber-400"
      : "bg-[#22d3ee]";

  async function send(
    url: string,
    body: Record<string, unknown>,
    which: NonNullable<typeof busy>,
  ): Promise<void> {
    setBusy(which);
    setError(null);
    try {
      const res = await fetch(url, {
        method: which === "keep_going" || which === "pause" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        summary?: BudgetSummary;
        error?: string;
      };
      if (!res.ok || !data.summary) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setSummary(data.summary);
      setDraftDollars(String(Math.round(data.summary.budgetCents / 100)));
      setEditing(false);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function saveBudget(): void {
    const dollars = Number(draftDollars);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Enter a whole-dollar amount, like 100.");
      return;
    }
    void send("/api/app/budget", { budgetCents: Math.round(dollars) * 100 }, "save");
  }

  function startEditing(): void {
    setEditing(true);
    setError(null);
    requestAnimationFrame(() => editRef.current?.focus());
  }

  return (
    <div className="space-y-6">
      {/* 80% three-button warn (PA-COST-13). Only when the owner hasn't already answered this period. */}
      {warning && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-amber-200">
              You&apos;re at {pct}% of your {dollarsFromCents(summary.budgetCents)} monthly cost budget
            </p>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">
              Your agents have spent {dollarsFromMicro(summary.spentMicroCents)} so far this month. Keep
              going, pause new agent runs for the month, or raise the cap?
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void send("/api/app/budget/decision", { decision: "keep_going" }, "keep_going")}
              disabled={busy !== null}
              className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors disabled:opacity-50"
            >
              {busy === "keep_going" ? "Saving…" : "Keep going"}
            </button>
            <button
              type="button"
              onClick={() => void send("/api/app/budget/decision", { decision: "pause" }, "pause")}
              disabled={busy !== null}
              className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
            >
              {busy === "pause" ? "Saving…" : "Pause new runs this month"}
            </button>
            <button
              type="button"
              onClick={startEditing}
              disabled={busy !== null}
              className="rounded-lg border border-slate-600/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800/60 transition-colors disabled:opacity-50"
            >
              Raise the cap
            </button>
          </div>
        </div>
      )}

      {/* Over-budget / paused notice (PA-COST-14). */}
      {(overBudget || paused) && !warning && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4">
          <p className="text-sm font-semibold text-red-200">
            {paused
              ? "New agent runs are paused for this month"
              : "You've reached your monthly cost budget"}
          </p>
          <p className="text-sm text-slate-300 mt-1 leading-relaxed">
            {paused
              ? "You paused new background agent runs for the rest of the month. Your chat still works. Raise the cap below to start them again, or they'll resume on their own next month."
              : "New background agent runs are paused so the bill can't run away. Your chat still works. Raise the cap below to let them run, or they'll resume when your budget resets next month."}
          </p>
        </div>
      )}

      {/* The gauge: cap, spend, reset date. */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-5 space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] text-slate-500 font-mono tracking-[0.14em] uppercase">
              This month
            </p>
            <p className="text-2xl font-bold text-slate-100 mt-0.5">
              {dollarsFromMicro(summary.spentMicroCents)}
              <span className="text-base font-medium text-slate-500">
                {" "}
                / {dollarsFromCents(summary.budgetCents)}
              </span>
            </p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className="shrink-0 rounded-lg border border-slate-600/60 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800/60 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">
          {pct}% used · resets {resetDateLabel(summary.periodResetAt)}
        </p>

        {editing && (
          <div className="pt-2 space-y-3 border-t border-slate-800/60">
            <label className="block text-sm text-slate-300">
              Monthly cap
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-slate-400">$</span>
                <input
                  ref={editRef}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={draftDollars}
                  onChange={(e) => setDraftDollars(e.target.value)}
                  className="w-32 rounded-lg border border-slate-600/60 bg-[#06080b] px-3 py-2 text-slate-100 focus:border-[#22d3ee] focus:outline-none"
                />
                <span className="text-sm text-slate-500">/ month</span>
              </div>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveBudget}
                disabled={busy !== null}
                className="rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#031820] hover:bg-[#06b6d4] transition-colors disabled:opacity-50"
              >
                {busy === "save" ? "Saving…" : "Save cap"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setDraftDollars(String(Math.round(summary.budgetCents / 100)));
                }}
                disabled={busy !== null}
                className="rounded-lg border border-slate-600/60 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/60 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {/* Tier default reset. */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-200">Reset to your plan&apos;s default</p>
          <p className="text-sm text-slate-400 mt-0.5">
            {dollarsFromCents(summary.tierDefaultCents)}/month on your current plan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void send("/api/app/budget", { reset: true }, "reset")}
          disabled={busy !== null || summary.budgetCents === summary.tierDefaultCents}
          className="shrink-0 rounded-lg border border-slate-600/60 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800/60 transition-colors disabled:opacity-40"
        >
          {busy === "reset" ? "Resetting…" : "Reset"}
        </button>
      </div>
    </div>
  );
}
