"use client";

// Auto-approve settings (SPEC §9.4, PA-ORCH-4). One toggle per (connector, action) the owner
// has staged before. The toggle is LOCKED until that action type clears the trust window — the
// owner has to approve it manually N times first. "Show me first" is always the safe default
// they can return to. Until an action type has ever been staged, there's nothing to show.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Setting = {
  connector: string;
  action: string;
  enabled: boolean;
  successCount: number;
  unlocked: boolean;
  lastToggledAt: string | null;
};

type SettingsResponse = { settings: Setting[]; trustWindow: number };

export default function AutoApproveClient() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [trustWindow, setTrustWindow] = useState(10);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/orchestrator/auto-approve", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as SettingsResponse;
      setSettings(data.settings);
      setTrustWindow(data.trustWindow);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(s: Setting) {
    const key = `${s.connector}:${s.action}`;
    setBusyKey(key);
    setErr(null);
    try {
      const res = await fetch("/api/orchestrator/auto-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connector: s.connector, action: s.action, enabled: !s.enabled }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; enabled?: boolean };
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      setSettings((prev) =>
        prev.map((p) =>
          p.connector === s.connector && p.action === s.action
            ? { ...p, enabled: data.enabled ?? !p.enabled }
            : p,
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#05070a]">
      <div className="max-w-2xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
        <div className="mb-2">
          <Link
            href="/app/settings"
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
          >
            ← Settings
          </Link>
        </div>

        <div className="mb-7">
          <div className="text-[10px] text-[#22d3ee]/60 font-mono tracking-[0.2em] uppercase mb-2">
            Trust ladder
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Auto-approve</h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            By default, Pocket Agent shows you every external action before it fires. Once you&apos;ve
            approved the same kind of action {trustWindow} times, you can let it run that action on
            its own. You can switch any of these back off at any time.
          </p>
        </div>

        {loading ? (
          <p className="text-sm font-mono text-slate-500">loading…</p>
        ) : err ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-6 py-6">
            <p className="text-red-400 text-sm font-mono">{err}</p>
          </div>
        ) : settings.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-6 py-10 text-center">
            <p className="text-slate-100 text-base font-semibold mb-2">Nothing to auto-approve yet</p>
            <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
              As Pocket Agent stages actions and you approve them, each action type shows up here.
              After {trustWindow} approvals of the same kind, you can let it run on its own.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {settings.map((s) => {
              const key = `${s.connector}:${s.action}`;
              const progress = Math.min(100, Math.round((s.successCount / trustWindow) * 100));
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold text-slate-100">
                        {s.connector} · {s.action}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {s.unlocked
                          ? "Unlocked — you can let this run on its own."
                          : `${s.successCount} of ${trustWindow} approvals toward unlocking`}
                      </p>
                    </div>
                    <button
                      onClick={() => void toggle(s)}
                      disabled={busyKey === key || (!s.enabled && !s.unlocked)}
                      aria-pressed={s.enabled}
                      title={
                        !s.unlocked && !s.enabled
                          ? `Unlocks after ${trustWindow} approvals`
                          : undefined
                      }
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        s.enabled ? "bg-[#22d3ee]" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
                          s.enabled ? "left-[1.375rem]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                  {!s.unlocked && (
                    <div className="mt-3 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-[#22d3ee]/60"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
