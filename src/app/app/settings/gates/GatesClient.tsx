"use client";

// Trust Ladder for the Gate Phase (SPEC §9, PA-GATE-5). One row per gate: turn a gate off entirely,
// or — once a gate has cleared its trust window — turn on per-gate Approve-anyway so its flags can be
// waved through with one tap. Enabling Approve-anyway is locked server-side until the window clears;
// turning a gate off is always allowed (the phase itself can't be switched off wholesale, PA-GATE-1).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type GateSetting = {
  name: string;
  label: string;
  description: string;
  appliesTo: "always" | "code";
  enabled: boolean;
  autoDismissEnabled: boolean;
  cleanPassCount: number;
  trustWindow: number;
  autoDismissUnlocked: boolean;
};

type SettingsResponse = { gates: GateSetting[]; provisioned: boolean };

export default function GatesClient() {
  const [gates, setGates] = useState<GateSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/orchestrator/gates/settings", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as SettingsResponse;
      setGates(data.gates);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(
    g: GateSetting,
    patch: { enabled?: boolean; autoDismissEnabled?: boolean },
  ) {
    setBusy(g.name);
    setErr(null);
    try {
      const res = await fetch("/api/orchestrator/gates/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateName: g.name, ...patch }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; gate?: GateSetting };
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      if (data.gate) {
        setGates((prev) => prev.map((p) => (p.name === g.name ? data.gate! : p)));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div className="max-w-2xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
        <div className="mb-2">
          <Link href="/app/settings" className="text-xs font-mono text-slate-500 hover:text-slate-300">
            ← Settings
          </Link>
        </div>
        <h1 className="text-xl font-semibold text-slate-100">Plan Gates</h1>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          Before any approved plan runs, a set of specialist checks reads it against your own rules — your
          voice, your protected customer names, your locked decisions, your engineering standards, security,
          tests, and connector spend. Clean plans run. Flagged plans wait for you. You can&apos;t turn the
          checks off entirely, but you can skip an individual one, and — once a check has passed cleanly
          enough times — let its flags be waved through with one tap.
        </p>

        {err && <p className="mt-4 text-sm text-red-400 font-mono">{err}</p>}
        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {gates.map((g) => (
              <div key={g.name} className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold text-slate-100">{g.label}</p>
                    <p className="mt-1 text-[12px] text-slate-400 leading-relaxed">{g.description}</p>
                    {g.appliesTo === "code" && (
                      <p className="mt-1 text-[11px] text-slate-600">Runs only on plans that build or edit code.</p>
                    )}
                  </div>
                  <button
                    onClick={() => void update(g, { enabled: !g.enabled })}
                    disabled={busy === g.name}
                    className={`shrink-0 min-h-[36px] px-3 rounded-xl border text-[12px] font-medium transition-colors disabled:opacity-50 ${
                      g.enabled
                        ? "border-emerald-500/30 text-emerald-300/90 hover:border-emerald-400/50"
                        : "border-slate-700/70 text-slate-500 hover:border-slate-500"
                    }`}
                  >
                    {g.enabled ? "On" : "Off"}
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800/60 pt-3">
                  <div className="text-[12px] text-slate-500">
                    Approve-anyway
                    <span className="ml-2 text-slate-600">
                      {g.autoDismissUnlocked
                        ? "unlocked"
                        : `unlocks after ${g.trustWindow} clean passes (${g.cleanPassCount}/${g.trustWindow})`}
                    </span>
                  </div>
                  <button
                    onClick={() => void update(g, { autoDismissEnabled: !g.autoDismissEnabled })}
                    disabled={busy === g.name || (!g.autoDismissUnlocked && !g.autoDismissEnabled)}
                    className={`shrink-0 min-h-[36px] px-3 rounded-xl border text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      g.autoDismissEnabled
                        ? "border-[#22d3ee]/40 text-[#22d3ee]/90 hover:border-[#22d3ee]/60"
                        : "border-slate-700/70 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {g.autoDismissEnabled ? "Auto-dismiss on" : g.autoDismissUnlocked ? "Turn on" : "Locked"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
